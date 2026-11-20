from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo import ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase

from app.core.hooks import sync_hooks
from app.core.sanitize import parse_object_id, safe_regex_pattern, sanitize_search_text
from app.models.user import AdminUserUpdateRequest, UserUpdateProfileRequest
from app.services.serializers import serialize_movie, serialize_user


async def update_my_profile(
    db: AsyncDatabase,
    current_user: dict[str, Any],
    payload: UserUpdateProfileRequest,
) -> dict[str, Any]:
    updates: dict[str, Any] = {}
    if payload.full_name is not None:
        updates["full_name"] = payload.full_name
    if payload.avatar_url is not None:
        updates["avatar_url"] = payload.avatar_url.strip() or None
    if payload.bio is not None:
        updates["bio"] = payload.bio.strip() or None
    if payload.favorite_genres is not None:
        updates["favorite_genres"] = [g.strip() for g in payload.favorite_genres if g.strip()]

    if not updates:
        return serialize_user(current_user)

    updates["updated_at"] = datetime.now(timezone.utc)
    updated = await db.users.find_one_and_update(
        {"_id": current_user["_id"]},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    await sync_hooks.emit(
        db,
        entity_type="user",
        entity_id=str(updated["_id"]),
        action="UPSERT",
        payload={"full_name": updated["full_name"], "favorite_genres": updated["favorite_genres"]},
    )
    return serialize_user(updated)


async def get_watchlist(db: AsyncDatabase, current_user: dict[str, Any]) -> list[dict[str, Any]]:
    watchlist_ids = [oid for oid in current_user.get("watchlist", []) if isinstance(oid, ObjectId)]
    if not watchlist_ids:
        return []

    cursor = db.movies.find({"_id": {"$in": watchlist_ids}, "is_deleted": False})
    docs = await cursor.to_list(length=len(watchlist_ids))
    by_id = {doc["_id"]: serialize_movie(doc) for doc in docs}
    # Preserve order user added (most recent first)
    return [by_id[oid] for oid in reversed(watchlist_ids) if oid in by_id]


async def add_to_watchlist(
    db: AsyncDatabase,
    current_user: dict[str, Any],
    movie_id_str: str,
) -> dict[str, Any]:
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    movie = await db.movies.find_one({"_id": movie_oid, "is_deleted": False})
    if movie is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")

    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"watchlist": movie_oid}, "$set": {"updated_at": now}},
    )
    await db.interactions.insert_one(
        {
            "user_id": current_user["_id"],
            "movie_id": movie_oid,
            "type": "WATCHLIST_ADD",
            "duration_sec": 0,
            "created_at": now,
        }
    )
    await sync_hooks.emit(
        db,
        entity_type="interaction",
        entity_id=f"{current_user['_id']}:{movie_oid}",
        action="UPSERT",
        payload={"user_id": str(current_user["_id"]), "movie_id": str(movie_oid), "type": "WATCHLIST_ADD"},
    )
    return {"message": "Added to watchlist.", "movie_id": str(movie_oid)}


async def remove_from_watchlist(
    db: AsyncDatabase,
    current_user: dict[str, Any],
    movie_id_str: str,
) -> dict[str, Any]:
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"watchlist": movie_oid}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Removed from watchlist.", "movie_id": str(movie_oid)}


async def admin_list_users(
    db: AsyncDatabase,
    *,
    q: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
    page: int = 1,
    limit: int = 20,
) -> dict[str, Any]:
    match_stage: dict[str, Any] = {}
    cleaned_q = sanitize_search_text(q)
    if cleaned_q:
        pattern = safe_regex_pattern(cleaned_q)
        match_stage["$or"] = [
            {"full_name": {"$regex": pattern, "$options": "i"}},
            {"email": {"$regex": pattern, "$options": "i"}},
        ]
    if role in ("user", "admin"):
        match_stage["role"] = role
    if is_active is not None:
        match_stage["is_active"] = is_active

    total = await db.users.count_documents(match_stage)
    skip = (page - 1) * limit

    pipeline = [
        {"$match": match_stage},
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "reviews",
                "localField": "_id",
                "foreignField": "user_id",
                "as": "_reviews",
            }
        },
        {
            "$project": {
                "email": 1,
                "full_name": 1,
                "role": 1,
                "is_active": 1,
                "avatar_url": 1,
                "favorite_genres": 1,
                "watchlist_count": {"$size": {"$ifNull": ["$watchlist", []]}},
                "review_count": {"$size": "$_reviews"},
                "created_at": 1,
                "updated_at": 1,
            }
        },
    ]
    cursor = await db.users.aggregate(pipeline)
    docs = await cursor.to_list(length=limit)

    items = [
        {
            "id": str(d["_id"]),
            "email": d["email"],
            "full_name": d["full_name"],
            "role": d["role"],
            "is_active": bool(d.get("is_active", True)),
            "avatar_url": d.get("avatar_url"),
            "favorite_genres": list(d.get("favorite_genres", [])),
            "watchlist_count": int(d.get("watchlist_count", 0)),
            "review_count": int(d.get("review_count", 0)),
            "created_at": d["created_at"],
            "updated_at": d["updated_at"],
        }
        for d in docs
    ]

    return {
        "items": items,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if total > 0 else 0,
        },
    }


async def admin_update_user(
    db: AsyncDatabase,
    admin_user: dict[str, Any],
    target_user_id: str,
    payload: AdminUserUpdateRequest,
) -> dict[str, Any]:
    target_oid = parse_object_id(target_user_id, "user_id")
    if target_oid == admin_user["_id"]:
        if payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrators cannot suspend their own account.",
            )
        if payload.role == "user":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrators cannot demote their own role.",
            )

    updates: dict[str, Any] = {}
    if payload.role is not None:
        updates["role"] = payload.role
    if payload.is_active is not None:
        updates["is_active"] = payload.is_active
    if payload.full_name is not None:
        updates["full_name"] = payload.full_name.strip()

    if not updates:
        existing = await db.users.find_one({"_id": target_oid})
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return serialize_user(existing)

    updates["updated_at"] = datetime.now(timezone.utc)
    updated = await db.users.find_one_and_update(
        {"_id": target_oid},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    return serialize_user(updated)
