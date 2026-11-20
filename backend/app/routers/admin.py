from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pymongo.asynchronous.database import AsyncDatabase

from app.core.database import get_db
from app.core.security import require_admin
from app.models.admin import AdminStatsResponse
from app.models.auth import UserPublic
from app.models.review import PaginatedReviewsResponse, ReviewModerateRequest, ReviewOut
from app.models.user import AdminUserUpdateRequest, PaginatedUsersResponse
from app.services import admin_service, review_service, user_service

router = APIRouter(prefix="/admin", tags=["Admin Console"])


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    _admin: dict[str, Any] = Depends(require_admin),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await admin_service.get_admin_stats(db)


@router.get("/sync-jobs")
async def list_recent_sync_jobs(
    limit: int = Query(default=12, ge=1, le=50),
    _admin: dict[str, Any] = Depends(require_admin),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await admin_service.get_recent_sync_jobs_and_indexes(db, limit=limit)


@router.get("/users", response_model=PaginatedUsersResponse)
async def list_users(
    q: str | None = Query(default=None, max_length=120),
    role: str | None = Query(default=None, pattern="^(user|admin)$"),
    is_active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1, le=500),
    limit: int = Query(default=20, ge=1, le=100),
    _admin: dict[str, Any] = Depends(require_admin),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await user_service.admin_list_users(
        db,
        q=q,
        role=role,
        is_active=is_active,
        page=page,
        limit=limit,
    )


@router.patch("/users/{user_id}", response_model=UserPublic)
async def update_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    admin_user: dict[str, Any] = Depends(require_admin),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await user_service.admin_update_user(db, admin_user, user_id, payload)


@router.get("/reviews", response_model=PaginatedReviewsResponse)
async def list_reviews_admin(
    q: str | None = Query(default=None, max_length=120),
    rating: int | None = Query(default=None, ge=1, le=5),
    is_hidden: bool | None = Query(default=None),
    movie_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1, le=500),
    limit: int = Query(default=20, ge=1, le=100),
    _admin: dict[str, Any] = Depends(require_admin),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await review_service.admin_list_reviews(
        db,
        q=q,
        rating=rating,
        is_hidden=is_hidden,
        movie_id=movie_id,
        page=page,
        limit=limit,
    )


@router.patch("/reviews/{review_id}/moderate", response_model=ReviewOut)
async def moderate_review(
    review_id: str,
    payload: ReviewModerateRequest,
    _admin: dict[str, Any] = Depends(require_admin),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await review_service.admin_moderate_review(
        db,
        review_id,
        is_hidden=payload.is_hidden,
    )
