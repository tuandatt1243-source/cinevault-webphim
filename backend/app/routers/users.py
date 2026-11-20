from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, status
from pymongo.asynchronous.database import AsyncDatabase

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import UserPublic
from app.models.movie import MovieOut
from app.models.user import UserUpdateProfileRequest
from app.services import user_service

router = APIRouter(prefix="/users", tags=["Users & Watchlist"])


@router.patch("/me", response_model=UserPublic)
async def update_profile(
    payload: UserUpdateProfileRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await user_service.update_my_profile(db, current_user, payload)


@router.get("/me/watchlist", response_model=list[MovieOut])
async def get_my_watchlist(
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db),
) -> list[dict[str, Any]]:
    return await user_service.get_watchlist(db, current_user)


@router.post("/me/watchlist/{movie_id}", status_code=status.HTTP_201_CREATED)
async def add_watchlist_item(
    movie_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await user_service.add_to_watchlist(db, current_user, movie_id)


@router.delete("/me/watchlist/{movie_id}")
async def remove_watchlist_item(
    movie_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await user_service.remove_from_watchlist(db, current_user, movie_id)
