from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core.hooks import get_cache_provider, sync_hooks
from app.core.security import create_access_token, hash_password, verify_password
from app.models.auth import LoginRequest, RegisterRequest
from app.services.serializers import serialize_user

logger = logging.getLogger("cinevault.auth")


async def register_user(db: AsyncDatabase, payload: RegisterRequest) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        "email": payload.email.lower().strip(),
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name.strip(),
        "role": "user",
        "is_active": True,
        "avatar_url": None,
        "bio": None,
        "favorite_genres": [g.strip() for g in payload.favorite_genres if g.strip()],
        "watchlist": [],
        "created_at": now,
        "updated_at": now,
    }
    try:
        res = await db.users.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email address is already registered.",
        ) from exc

    doc["_id"] = res.inserted_id
    user_id = str(res.inserted_id)

    await sync_hooks.emit(
        db,
        entity_type="user",
        entity_id=user_id,
        action="UPSERT",
        payload={"email": doc["email"], "full_name": doc["full_name"], "favorite_genres": doc["favorite_genres"]},
    )

    token, _jti, expires_in = create_access_token(user_id=user_id, role=doc["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "user": serialize_user(doc),
    }


async def login_user(db: AsyncDatabase, payload: LoginRequest) -> dict[str, Any]:
    # Strict string query only — never pass raw dicts
    email = str(payload.email).lower().strip()
    user = await db.users.find_one({"email": email})
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Contact an administrator.",
        )

    token, _jti, expires_in = create_access_token(user_id=str(user["_id"]), role=user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "user": serialize_user(user),
    }


async def logout_user(current_user: dict[str, Any]) -> dict[str, str]:
    jti = current_user.get("_token_jti")
    exp = int(current_user.get("_token_exp", 0))
    now_ts = int(datetime.now(timezone.utc).timestamp())
    remaining = max(exp - now_ts, 60)

    if jti:
        try:
            await get_cache_provider().blacklist_token(jti, remaining)
        except Exception as exc:
            logger.warning("Redis blacklist_token skipped (graceful fallback): %s", exc)

    return {"message": "Signed out successfully."}
