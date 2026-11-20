from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import FileResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.core.database import get_db
from app.core.security import get_optional_user, require_admin
from app.models.movie import (
    GenreFacet,
    MovieCreateRequest,
    MovieOut,
    MovieUpdateRequest,
    PaginatedMoviesResponse,
)
from app.services import movie_service, poster_service, translate_service

router = APIRouter(prefix="/movies", tags=["Movies"])


@router.get("/genres", response_model=list[GenreFacet])
async def get_genres(db: AsyncDatabase = Depends(get_db)) -> list[dict[str, Any]]:
    return await movie_service.list_genres_facets(db)


@router.get("", response_model=PaginatedMoviesResponse)
async def get_movies(
    response: Response,
    q: str | None = Query(default=None, max_length=120),
    genre: str | None = Query(default=None, max_length=64),
    year: int | None = Query(default=None, ge=1888, le=2100),
    min_rating: float | None = Query(default=None, ge=0.0, le=5.0),
    sort: str = Query(default="rating", pattern="^(newest|created|rating|views|title|year_asc)$"),
    status_filter: str = Query(default="active", alias="status", pattern="^(active|deleted|all)$"),
    page: int = Query(default=1, ge=1, le=500),
    limit: int = Query(default=20, ge=1, le=200),
    current_user: dict[str, Any] | None = Depends(get_optional_user),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    # Only administrators can inspect soft-deleted or all movies
    is_admin = current_user is not None and current_user.get("role") == "admin"
    effective_status = status_filter if is_admin else "active"
    include_deleted = is_admin and effective_status in ("deleted", "all")

    data, cache_status = await movie_service.list_movies(
        db,
        q=q,
        genre=genre,
        year=year,
        min_rating=min_rating,
        sort=sort,
        status_filter=effective_status,
        include_deleted=include_deleted,
        page=page,
        limit=limit,
    )
    response.headers["X-Cache"] = cache_status
    return data


@router.get("/{movie_id}/translate")
async def translate_movie_overview(
    movie_id: str,
    lang: str = Query(default="vi", pattern="^(vi|en|ja|ko|fr|zh)$"),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await translate_service.get_or_translate_movie_overview(db, movie_id, lang)


@router.get("/{movie_id}/poster")
async def get_movie_poster(
    movie_id: str,
    db: AsyncDatabase = Depends(get_db),
) -> FileResponse:
    cache_path, media_type = await poster_service.get_or_cache_movie_poster(db, movie_id)
    return FileResponse(
        path=cache_path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/{movie_id}", response_model=MovieOut)
async def get_movie(
    movie_id: str,
    response: Response,
    track_view: bool = Query(default=True),
    current_user: dict[str, Any] | None = Depends(get_optional_user),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    is_admin = current_user is not None and current_user.get("role") == "admin"
    viewer_id = str(current_user["_id"]) if current_user is not None else None
    data, cache_status = await movie_service.get_movie_detail(
        db,
        movie_id,
        include_deleted=is_admin,
        record_view=track_view,
        viewer_user_id=viewer_id,
    )
    response.headers["X-Cache"] = cache_status
    return data


@router.post("", response_model=MovieOut, status_code=status.HTTP_201_CREATED)
async def create_movie(
    payload: MovieCreateRequest,
    _admin: dict[str, Any] = Depends(require_admin),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await movie_service.create_movie(db, payload)


@router.put("/{movie_id}", response_model=MovieOut)
async def update_movie(
    movie_id: str,
    payload: MovieUpdateRequest,
    _admin: dict[str, Any] = Depends(require_admin),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await movie_service.update_movie(db, movie_id, payload)


@router.delete("/{movie_id}", response_model=MovieOut)
async def soft_delete_movie(
    movie_id: str,
    _admin: dict[str, Any] = Depends(require_admin),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await movie_service.soft_delete_movie(db, movie_id)


@router.post("/{movie_id}/restore", response_model=MovieOut)
async def restore_movie(
    movie_id: str,
    _admin: dict[str, Any] = Depends(require_admin),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await movie_service.restore_movie(db, movie_id)
