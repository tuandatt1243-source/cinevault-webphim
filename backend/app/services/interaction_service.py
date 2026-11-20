from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from pymongo.asynchronous.database import AsyncDatabase

from app.core.hooks import sync_hooks
from app.core.sanitize import parse_object_id
from app.models.interaction import InteractionCreateRequest
from app.services.serializers import serialize_interaction


async def create_interaction(
    db: AsyncDatabase,
    current_user: dict[str, Any],
    payload: InteractionCreateRequest,
) -> dict[str, Any]:
    movie_oid = parse_object_id(payload.movie_id, "movie_id")
    movie = await db.movies.find_one({"_id": movie_oid, "is_deleted": False})
    if movie is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": current_user["_id"],
        "movie_id": movie_oid,
        "type": payload.type,
        "duration_sec": int(payload.duration_sec),
        "created_at": now,
    }
    res = await db.interactions.insert_one(doc)
    doc["_id"] = res.inserted_id

    if payload.type in ("VIEW", "WATCH"):
        await db.movies.update_one({"_id": movie_oid}, {"$inc": {"views_count": 1}})

    await sync_hooks.emit(
        db,
        entity_type="interaction",
        entity_id=str(res.inserted_id),
        action="UPSERT",
        payload={
            "user_id": str(current_user["_id"]),
            "movie_id": str(movie_oid),
            "type": payload.type,
            "duration_sec": int(payload.duration_sec),
        },
    )
    return serialize_interaction(doc)
