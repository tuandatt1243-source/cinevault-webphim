from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo import ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase

from app.core.hooks import get_cache_provider, sync_hooks
from app.core.sanitize import parse_object_id, safe_regex_pattern, sanitize_search_text
from app.models.review import ReviewUpsertRequest
from app.services.serializers import serialize_review

logger = logging.getLogger("cinevault.reviews")


async def recalculate_movie_rating(db: AsyncDatabase, movie_oid: ObjectId) -> tuple[float, int]:
    """Recalculate avg_rating & rating_count using MongoDB Aggregation over visible reviews."""
    pipeline = [
        {"$match": {"movie_id": movie_oid, "is_hidden": False}},
        {
            "$group": {
                "_id": "$movie_id",
                "avg_rating": {"$avg": "$rating"},
                "rating_count": {"$sum": 1},
            }
        },
    ]
    cursor = await db.reviews.aggregate(pipeline)
    rows = await cursor.to_list(length=1)
    if rows:
        avg_rating = round(float(rows[0]["avg_rating"]), 2)
        rating_count = int(rows[0]["rating_count"])
    else:
        avg_rating = 0.0
        rating_count = 0

    await db.movies.update_one(
        {"_id": movie_oid},
        {
            "$set": {
                "avg_rating": avg_rating,
                "rating_count": rating_count,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    try:
        await get_cache_provider().invalidate_movie(str(movie_oid))
        await get_cache_provider().invalidate_movie_lists()
    except Exception as exc:
        logger.warning("Redis invalidation after review recalc skipped: %s", exc)
    return avg_rating, rating_count


async def list_movie_reviews(
    db: AsyncDatabase,
    movie_id_str: str,
    *,
    include_hidden: bool = False,
    page: int = 1,
    limit: int = 20,
) -> dict[str, Any]:
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    if not include_hidden:
        active_movie = await db.movies.find_one({"_id": movie_oid, "is_deleted": False}, {"_id": 1})
        if active_movie is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")

    match_stage: dict[str, Any] = {"movie_id": movie_oid}
    if not include_hidden:
        match_stage["is_hidden"] = False

    total = await db.reviews.count_documents(match_stage)
    skip = (page - 1) * limit

    pipeline = [
        {"$match": match_stage},
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "_id",
                "as": "user_doc",
            }
        },
        {"$unwind": {"path": "$user_doc", "preserveNullAndEmptyArrays": True}},
        {
            "$addFields": {
                "user_name": "$user_doc.full_name",
                "user_email": "$user_doc.email",
            }
        },
        {"$project": {"user_doc": 0}},
    ]
    cursor = await db.reviews.aggregate(pipeline)
    docs = await cursor.to_list(length=limit)

    return {
        "items": [serialize_review(d) for d in docs],
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if total > 0 else 0,
        },
    }


async def upsert_review(
    db: AsyncDatabase,
    current_user: dict[str, Any],
    movie_id_str: str,
    payload: ReviewUpsertRequest,
) -> dict[str, Any]:
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    movie = await db.movies.find_one({"_id": movie_oid, "is_deleted": False})
    if movie is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")

    now = datetime.now(timezone.utc)
    doc = await db.reviews.find_one_and_update(
        {"user_id": current_user["_id"], "movie_id": movie_oid},
        {
            "$set": {
                "rating": int(payload.rating),
                "comment": payload.comment,
                "updated_at": now,
            },
            "$setOnInsert": {
                "is_hidden": False,
                "created_at": now,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    await recalculate_movie_rating(db, movie_oid)

    await sync_hooks.emit(
        db,
        entity_type="review",
        entity_id=str(doc["_id"]),
        action="UPSERT",
        payload={
            "user_id": str(current_user["_id"]),
            "movie_id": str(movie_oid),
            "rating": int(payload.rating),
        },
    )

    doc["user_name"] = current_user.get("full_name")
    doc["user_email"] = current_user.get("email")
    doc["movie_title"] = movie.get("title")
    doc["movie_poster_url"] = movie.get("poster_url")
    return serialize_review(doc)


async def delete_review(
    db: AsyncDatabase,
    current_user: dict[str, Any],
    review_id_str: str,
) -> dict[str, Any]:
    review_oid = parse_object_id(review_id_str, "review_id")
    existing = await db.reviews.find_one({"_id": review_oid})
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")

    is_owner = existing["user_id"] == current_user["_id"]
    is_admin = current_user.get("role") == "admin"
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own reviews.",
        )

    await db.reviews.delete_one({"_id": review_oid})
    await recalculate_movie_rating(db, existing["movie_id"])

    await sync_hooks.emit(
        db,
        entity_type="review",
        entity_id=review_id_str,
        action="DELETE",
        payload={"user_id": str(existing["user_id"]), "movie_id": str(existing["movie_id"])},
    )
    return {"message": "Review deleted successfully."}


async def admin_list_reviews(
    db: AsyncDatabase,
    *,
    q: str | None = None,
    rating: int | None = None,
    is_hidden: bool | None = None,
    movie_id: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> dict[str, Any]:
    match_stage: dict[str, Any] = {}
    if rating is not None and 1 <= rating <= 5:
        match_stage["rating"] = int(rating)
    if is_hidden is not None:
        match_stage["is_hidden"] = is_hidden
    if movie_id:
        match_stage["movie_id"] = parse_object_id(movie_id, "movie_id")

    cleaned_q = sanitize_search_text(q)
    skip = (page - 1) * limit

    base_pipeline: list[dict[str, Any]] = [
        {"$match": match_stage},
        {"$sort": {"created_at": -1}},
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "_id",
                "as": "user_doc",
            }
        },
        {"$unwind": {"path": "$user_doc", "preserveNullAndEmptyArrays": True}},
        {
            "$lookup": {
                "from": "movies",
                "localField": "movie_id",
                "foreignField": "_id",
                "as": "movie_doc",
            }
        },
        {"$unwind": {"path": "$movie_doc", "preserveNullAndEmptyArrays": True}},
        {
            "$addFields": {
                "user_name": "$user_doc.full_name",
                "user_email": "$user_doc.email",
                "movie_title": "$movie_doc.title",
                "movie_poster_url": "$movie_doc.poster_url",
            }
        },
        {"$project": {"user_doc": 0, "movie_doc": 0}},
    ]

    if cleaned_q:
        pattern = safe_regex_pattern(cleaned_q)
        base_pipeline.append(
            {
                "$match": {
                    "$or": [
                        {"comment": {"$regex": pattern, "$options": "i"}},
                        {"movie_title": {"$regex": pattern, "$options": "i"}},
                        {"user_name": {"$regex": pattern, "$options": "i"}},
                        {"user_email": {"$regex": pattern, "$options": "i"}},
                    ]
                }
            }
        )

    facet_pipeline = [
        *base_pipeline,
        {
            "$facet": {
                "items": [{"$skip": skip}, {"$limit": limit}],
                "count": [{"$count": "total"}],
            }
        },
    ]

    cursor = await db.reviews.aggregate(facet_pipeline)
    result = await cursor.to_list(length=1)
    items_docs = result[0]["items"] if result else []
    total = int(result[0]["count"][0]["total"]) if result and result[0]["count"] else 0

    return {
        "items": [serialize_review(d) for d in items_docs],
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if total > 0 else 0,
        },
    }


async def admin_moderate_review(
    db: AsyncDatabase,
    review_id_str: str,
    *,
    is_hidden: bool,
) -> dict[str, Any]:
    review_oid = parse_object_id(review_id_str, "review_id")
    updated = await db.reviews.find_one_and_update(
        {"_id": review_oid},
        {"$set": {"is_hidden": bool(is_hidden), "updated_at": datetime.now(timezone.utc)}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")

    await recalculate_movie_rating(db, updated["movie_id"])
    return serialize_review(updated)
