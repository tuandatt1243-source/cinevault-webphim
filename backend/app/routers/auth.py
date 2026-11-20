from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, status
from pymongo.asynchronous.database import AsyncDatabase

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import LoginRequest, RegisterRequest, TokenResponse, UserPublic
from app.models.common import MessageResponse
from app.services import auth_service
from app.services.serializers import serialize_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncDatabase = Depends(get_db)) -> dict[str, Any]:
    return await auth_service.register_user(db, payload)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncDatabase = Depends(get_db)) -> dict[str, Any]:
    return await auth_service.login_user(db, payload)


@router.post("/logout", response_model=MessageResponse)
async def logout(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, str]:
    return await auth_service.logout_user(current_user)


@router.get("/me", response_model=UserPublic)
async def me(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return serialize_user(current_user)
