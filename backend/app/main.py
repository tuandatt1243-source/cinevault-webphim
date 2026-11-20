from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.database import mongo_manager
from app.core.sanitize import assert_no_mongo_operators
from app.db.schemas import ensure_collections_and_indexes
from app.routers import admin, assistant, auth, health, interactions, movies, reviews, users

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("cinevault.main")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    db = await mongo_manager.connect()
    try:
        await ensure_collections_and_indexes(db)
        logger.info("MongoDB connected and schema/indexes verified.")
    except Exception as exc:
        logger.warning("MongoDB schema initialization deferred: %s", exc)
    yield
    await mongo_manager.close()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="Titofilm — Polyglot NoSQL Movie Management & Personalized Recommendation Platform (TV1 Core)",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Cache"],
    )

    @app.middleware("http")
    async def block_nosql_operator_payloads(request: Request, call_next):
        # Inspect query parameters for raw MongoDB operator injection
        for key, value in request.query_params.multi_items():
            if key.startswith("$") or "\x00" in key or "\x00" in value:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Unsafe query operator detected in query string."},
                )
        # Inspect JSON request bodies for keys beginning with '$'
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type and request.method in ("POST", "PUT", "PATCH"):
            body = await request.body()
            if body:
                try:
                    parsed = json.loads(body)
                    assert_no_mongo_operators(parsed)
                except HTTPException as exc:
                    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
                except json.JSONDecodeError:
                    pass
        return await call_next(request)

    prefix = settings.api_v1_prefix
    app.include_router(health.router, prefix=prefix)
    app.include_router(auth.router, prefix=prefix)
    app.include_router(users.router, prefix=prefix)
    app.include_router(movies.router, prefix=prefix)
    app.include_router(reviews.router, prefix=prefix)
    app.include_router(interactions.router, prefix=prefix)
    app.include_router(assistant.router, prefix=prefix)
    app.include_router(admin.router, prefix=prefix)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "docs": "/docs",
            "health": f"{prefix}/health",
        }

    return app


app = create_app()
