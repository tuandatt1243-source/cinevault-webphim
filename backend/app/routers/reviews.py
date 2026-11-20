from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, status
from pymongo.asynchronous.database import AsyncDatabase

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
from app.models.common import MessageResponse
from app.models.review import PaginatedReviewsResponse, ReviewOut, ReviewUpsertRequest
from app.services import review_service

router = APIRouter(tags=["Reviews & Ratings"])


@router.get("/movies/{movie_id}/reviews", response_model=PaginatedReviewsResponse)
async def get_movie_reviews(
    movie_id: str,
    page: int = Query(default=1, ge=1, le=500),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict[str, Any] | None = Depends(get_optional_user),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    is_admin = current_user is not None and current_user.get("role") == "admin"
    return await review_service.list_movie_reviews(
        db,
        movie_id,
        include_hidden=is_admin,
        page=page,
        limit=limit,
    )


@router.post(
    "/movies/{movie_id}/reviews",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
)
async def upsert_movie_review(
    movie_id: str,
    payload: ReviewUpsertRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await review_service.upsert_review(db, current_user, movie_id, payload)


@router.delete("/reviews/{review_id}", response_model=MessageResponse)
async def remove_review(
    review_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await review_service.delete_review(db, current_user, review_id)
