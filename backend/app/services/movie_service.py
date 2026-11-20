from __future__ import annotations

import hashlib
import logging
import math
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from pymongo import DESCENDING, ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core.hooks import get_cache_provider, sync_hooks
from app.core.sanitize import parse_object_id, safe_regex_pattern, sanitize_search_text, slugify
from app.models.movie import MovieCreateRequest, MovieUpdateRequest
from app.services.poster_service import get_cached_poster_path
from app.services.serializers import serialize_movie

logger = logging.getLogger("cinevault.movies")

ALLOWED_SORTS: dict[str, list[tuple[str, int]]] = {
    "newest": [("release_year", DESCENDING), ("avg_rating", DESCENDING)],
    "created": [("created_at", DESCENDING)],
    "rating": [("avg_rating", DESCENDING), ("rating_count", DESCENDING)],
    "views": [("views_count", DESCENDING), ("avg_rating", DESCENDING)],
    "title": [("title", 1)],
    "year_asc": [("release_year", 1), ("avg_rating", DESCENDING)],
}


async def list_movies(
    db: AsyncDatabase,
    *,
    q: str | None = None,
    genre: str | None = None,
    year: int | None = None,
    min_rating: float | None = None,
    sort: str = "rating",
    status_filter: str = "active",
    include_deleted: bool = False,
    page: int = 1,
    limit: int = 20,
) -> tuple[dict[str, Any], str]:
    cleaned_q = sanitize_search_text(q)
    cache_provider = get_cache_provider()

    # Only cache public active queries
    cache_status = "BYPASS"
    cache_key: str | None = None
    if not include_deleted and status_filter == "active":
        raw_sig = f"q={cleaned_q}|g={genre}|y={year}|r={min_rating}|s={sort}|p={page}|l={limit}"
        cache_key = "movies:list:" + hashlib.md5(raw_sig.encode("utf-8")).hexdigest()
        try:
            cached, cache_status = await cache_provider.get_json(cache_key)
            if cached is not None:
                return cached, cache_status
        except Exception as exc:
            logger.warning("Redis movie list lookup bypassed: %s", exc)
            cache_status = "BYPASS"

    base_filter: dict[str, Any] = {}
    if status_filter == "deleted":
        base_filter["is_deleted"] = True
    elif status_filter == "all" and include_deleted:
        pass
    else:
        base_filter["is_deleted"] = False

    if genre and genre.strip():
        base_filter["genres"] = genre.strip()
    if year is not None:
        base_filter["release_year"] = int(year)
    if min_rating is not None:
        base_filter["avg_rating"] = {"$gte": float(min_rating)}

    sort_spec = ALLOWED_SORTS.get(sort, ALLOWED_SORTS["rating"])
    skip = (page - 1) * limit

    used_text_query = False
    query_filter = dict(base_filter)
    if cleaned_q:
        # Primary: MongoDB Text Index search
        text_filter = {**base_filter, "$text": {"$search": cleaned_q}}
        total = await db.movies.count_documents(text_filter)
        if total > 0:
            used_text_query = True
            query_filter = text_filter
        else:
            # Graceful partial-prefix fallback using escaped regex (safe against ReDoS/injection)
            pattern = safe_regex_pattern(cleaned_q)
            query_filter = {
                **base_filter,
                "$or": [
                    {"title": {"$regex": pattern, "$options": "i"}},
                    {"directors": {"$regex": pattern, "$options": "i"}},
                    {"cast": {"$regex": pattern, "$options": "i"}},
                ],
            }
            total = await db.movies.count_documents(query_filter)
    else:
        total = await db.movies.count_documents(query_filter)

    if used_text_query:
        cursor = (
            db.movies.find(query_filter, {"score": {"$meta": "textScore"}})
            .sort([("score", {"$meta": "textScore"}), *sort_spec])
            .skip(skip)
            .limit(limit)
        )
    else:
        cursor = db.movies.find(query_filter).sort(sort_spec).skip(skip).limit(limit)

    docs = await cursor.to_list(length=limit)
    payload = {
        "items": [serialize_movie(d) for d in docs],
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if total > 0 else 0,
        },
    }

    if cache_key is not None and cache_status == "MISS":
        try:
            await cache_provider.set_json(cache_key, payload, ttl_seconds=180)
        except Exception as exc:
            logger.warning("Redis movie list set skipped: %s", exc)

    return payload, cache_status


async def get_movie_detail(
    db: AsyncDatabase,
    movie_id_str: str,
    *,
    include_deleted: bool = False,
    record_view: bool = True,
    viewer_user_id: str | None = None,
) -> tuple[dict[str, Any], str]:
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    cache_provider = get_cache_provider()
    cache_status = "BYPASS"
    cache_key = f"movies:detail:{movie_id_str}"

    if not include_deleted:
        try:
            cached, cache_status = await cache_provider.get_json(cache_key)
            if cached is not None:
                if record_view:
                    await _record_view_side_effects(db, movie_oid, movie_id_str, viewer_user_id)
                return cached, cache_status
        except Exception as exc:
            logger.warning("Redis movie detail lookup bypassed: %s", exc)
            cache_status = "BYPASS"

    query: dict[str, Any] = {"_id": movie_oid}
    if not include_deleted:
        query["is_deleted"] = False

    doc = await db.movies.find_one(query)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")

    if record_view and not doc.get("is_deleted", False):
        await _record_view_side_effects(db, movie_oid, movie_id_str, viewer_user_id)
        doc["views_count"] = int(doc.get("views_count", 0)) + 1

    serialized = serialize_movie(doc)
    if not include_deleted and cache_status == "MISS":
        try:
            await cache_provider.set_json(cache_key, serialized, ttl_seconds=300)
        except Exception as exc:
            logger.warning("Redis movie detail set skipped: %s", exc)

    return serialized, cache_status


async def _record_view_side_effects(
    db: AsyncDatabase,
    movie_oid: Any,
    movie_id_str: str,
    viewer_user_id: str | None,
) -> None:
    await db.movies.update_one({"_id": movie_oid}, {"$inc": {"views_count": 1}})
    if viewer_user_id:
        user_oid = parse_object_id(viewer_user_id, "user_id")
        await db.interactions.insert_one(
            {
                "user_id": user_oid,
                "movie_id": movie_oid,
                "type": "VIEW",
                "duration_sec": 0,
                "created_at": datetime.now(timezone.utc),
            }
        )
    try:
        await get_cache_provider().record_movie_view(movie_id_str, viewer_user_id)
    except Exception as exc:
        logger.warning("Redis record_movie_view skipped: %s", exc)


async def list_genres_facets(db: AsyncDatabase) -> list[dict[str, Any]]:
    pipeline = [
        {"$match": {"is_deleted": False}},
        {"$unwind": "$genres"},
        {"$group": {"_id": "$genres", "count": {"$sum": 1}}},
        {"$sort": {"count": -1, "_id": 1}},
        {"$project": {"_id": 0, "name": "$_id", "count": 1}},
    ]
    cursor = await db.movies.aggregate(pipeline)
    return await cursor.to_list(length=100)


async def create_movie(db: AsyncDatabase, payload: MovieCreateRequest) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    base_slug = payload.slug.strip().lower() if payload.slug else slugify(payload.title, payload.release_year)

    doc = {
        "slug": base_slug,
        "title": payload.title,
        "original_title": payload.original_title,
        "overview": payload.overview,
        "release_year": int(payload.release_year),
        "runtime_minutes": int(payload.runtime_minutes),
        "certificate": payload.certificate,
        "poster_url": payload.poster_url,
        "backdrop_url": payload.backdrop_url,
        "trailer_url": payload.trailer_url,
        "genres": payload.genres,
        "cast": payload.cast,
        "directors": payload.directors,
        "language": payload.language,
        "country": payload.country,
        "imdb_rating": float(payload.imdb_rating) if payload.imdb_rating is not None else None,
        "meta_score": int(payload.meta_score) if payload.meta_score is not None else None,
        "avg_rating": 0.0,
        "rating_count": 0,
        "views_count": 0,
        "is_deleted": False,
        "deleted_at": None,
        "created_at": now,
        "updated_at": now,
    }

    try:
        res = await db.movies.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A movie with slug '{base_slug}' already exists.",
        ) from exc

    doc["_id"] = res.inserted_id
    serialized = serialize_movie(doc)

    await sync_hooks.emit(
        db,
        entity_type="movie",
        entity_id=serialized["id"],
        action="UPSERT",
        payload={
            "title": serialized["title"],
            "release_year": serialized["release_year"],
            "genres": serialized["genres"],
            "cast": serialized["cast"],
            "directors": serialized["directors"],
        },
    )
    await _invalidate_movie_caches_safe(serialized["id"])
    return serialized


async def update_movie(
    db: AsyncDatabase,
    movie_id_str: str,
    payload: MovieUpdateRequest,
) -> dict[str, Any]:
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        existing = await db.movies.find_one({"_id": movie_oid})
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")
        return serialize_movie(existing)

    if "imdb_rating" in updates and updates["imdb_rating"] is not None:
        updates["imdb_rating"] = float(updates["imdb_rating"])
    updates["updated_at"] = datetime.now(timezone.utc)

    updated = await db.movies.find_one_and_update(
        {"_id": movie_oid},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")

    if "poster_url" in updates:
        get_cached_poster_path(movie_id_str).unlink(missing_ok=True)

    serialized = serialize_movie(updated)
    await sync_hooks.emit(
        db,
        entity_type="movie",
        entity_id=serialized["id"],
        action="UPSERT",
        payload={
            "title": serialized["title"],
            "release_year": serialized["release_year"],
            "genres": serialized["genres"],
            "cast": serialized["cast"],
            "directors": serialized["directors"],
            "replace_relations": True,
        },
    )
    await _invalidate_movie_caches_safe(serialized["id"])
    return serialized


async def soft_delete_movie(db: AsyncDatabase, movie_id_str: str) -> dict[str, Any]:
    """Soft-delete movie (is_deleted=True, deleted_at=now) and notify Neo4j + Redis hooks."""
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    now = datetime.now(timezone.utc)
    updated = await db.movies.find_one_and_update(
        {"_id": movie_oid, "is_deleted": False},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        existing = await db.movies.find_one({"_id": movie_oid})
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Movie is already archived/deleted.")

    await sync_hooks.emit(
        db,
        entity_type="movie",
        entity_id=movie_id_str,
        action="DELETE",
        payload={"soft_deleted": True},
    )
    await _invalidate_movie_caches_safe(movie_id_str)
    return serialize_movie(updated)


async def restore_movie(db: AsyncDatabase, movie_id_str: str) -> dict[str, Any]:
    """Restore a soft-deleted movie back into the active catalog and re-trigger Neo4j sync."""
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    now = datetime.now(timezone.utc)
    updated = await db.movies.find_one_and_update(
        {"_id": movie_oid, "is_deleted": True},
        {"$set": {"is_deleted": False, "deleted_at": None, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        existing = await db.movies.find_one({"_id": movie_oid})
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Movie is already active.")

    serialized = serialize_movie(updated)
    await sync_hooks.emit(
        db,
        entity_type="movie",
        entity_id=serialized["id"],
        action="RESTORE",
        payload={
            "title": serialized["title"],
            "release_year": serialized["release_year"],
            "genres": serialized["genres"],
            "cast": serialized["cast"],
            "directors": serialized["directors"],
        },
    )
    await _invalidate_movie_caches_safe(serialized["id"])
    return serialized


async def _invalidate_movie_caches_safe(movie_id: str) -> None:
    try:
        provider = get_cache_provider()
        await provider.invalidate_movie(movie_id)
        await provider.invalidate_movie_lists()
    except Exception as exc:
        logger.warning("Redis cache invalidation skipped: %s", exc)
