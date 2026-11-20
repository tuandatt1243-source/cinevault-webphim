from __future__ import annotations

from fastapi import APIRouter

from app.core.database import mongo_manager

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check() -> dict[str, object]:
    mongo_ok = await mongo_manager.ping()
    return {
        "status": "ok" if mongo_ok else "degraded",
        "databases": {
            "mongodb": "connected" if mongo_ok else "disconnected",
        },
    }
