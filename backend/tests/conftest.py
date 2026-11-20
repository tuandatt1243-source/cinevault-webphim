from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.core.database import mongo_manager
from app.core.security import create_access_token, hash_password
from app.db.schemas import ensure_collections_and_indexes
from app.main import create_app


@pytest_asyncio.fixture
async def test_db():
    settings = get_settings()
    test_db_name = f"{settings.mongodb_db_name}_pytest"
    await mongo_manager.close()
    db = await mongo_manager.connect(db_name=test_db_name)
    await db.client.drop_database(test_db_name)
    await ensure_collections_and_indexes(db)
    yield db
    await db.client.drop_database(test_db_name)
    await mongo_manager.close()


@pytest_asyncio.fixture
async def client(test_db) -> AsyncIterator[AsyncClient]:
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_account(test_db) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        "email": "admin.test@cinevault.local",
        "password_hash": hash_password("Admin@123"),
        "full_name": "Test Admin",
        "role": "admin",
        "is_active": True,
        "avatar_url": None,
        "bio": None,
        "favorite_genres": ["Drama", "Sci-Fi"],
        "watchlist": [],
        "created_at": now,
        "updated_at": now,
    }
    res = await test_db.users.insert_one(doc)
    token, _, _ = create_access_token(str(res.inserted_id), "admin")
    return {"id": str(res.inserted_id), "email": doc["email"], "token": token}


@pytest_asyncio.fixture
async def user_account(test_db) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        "email": "viewer.test@cinevault.local",
        "password_hash": hash_password("User@123"),
        "full_name": "Test Viewer",
        "role": "user",
        "is_active": True,
        "avatar_url": None,
        "bio": None,
        "favorite_genres": ["Action"],
        "watchlist": [],
        "created_at": now,
        "updated_at": now,
    }
    res = await test_db.users.insert_one(doc)
    token, _, _ = create_access_token(str(res.inserted_id), "user")
    return {"id": str(res.inserted_id), "email": doc["email"], "token": token}
