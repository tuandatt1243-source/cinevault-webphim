from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import get_settings
from app.core.database import get_db
from app.core.hooks import get_cache_provider

logger = logging.getLogger("cinevault.security")

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(plain_password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, role: str, expires_minutes: int | None = None) -> tuple[str, str, int]:
    settings = get_settings()
    ttl_min = expires_minutes if expires_minutes is not None else settings.jwt_access_token_expire_minutes
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=ttl_min)
    jti = uuid.uuid4().hex
    payload = {
        "sub": str(user_id),
        "role": role,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, jti, int(ttl_min * 60)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "role", "jti", "exp"]},
        )
        return payload
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def _check_blacklist_safe(jti: str) -> bool:
    try:
        return await get_cache_provider().is_token_blacklisted(jti)
    except Exception as exc:
        # Fail-open with warning so read/auth flows degrade gracefully if Redis goes down
        logger.warning("Redis blacklist check skipped (graceful fallback): %s", exc)
        return False


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    jti = payload.get("jti", "")
    if jti and await _check_blacklist_safe(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = payload.get("sub", "")
    if not ObjectId.is_valid(sub):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token subject.",
        )

    user = await db.users.find_one({"_id": ObjectId(sub)})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Contact an administrator.",
        )

    user["_token_jti"] = jti
    user["_token_exp"] = payload.get("exp", 0)
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any] | None:
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials=credentials, db=db)
    except HTTPException:
        return None


async def require_admin(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required.",
        )
    return current_user
