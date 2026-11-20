from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from pymongo.asynchronous.database import AsyncDatabase

logger = logging.getLogger("cinevault.hooks")

SyncCallback = Callable[[dict[str, Any]], Awaitable[None]]


class SyncHookRegistry:
    """
    Integration contract between TV1 (MongoDB Source of Truth) and TV2 (Neo4j Sync Service).

    Every mutation in TV1 writes a durable audit/queue record to MongoDB `sync_jobs`.
    When TV2 mounts `sync_service.py`, TV2 registers an async handler via
    `sync_hooks.register_handler(handler)`. Failures are caught, logged into `sync_jobs`
    with status='FAILED' and retry_count incremented, never breaking MongoDB writes.
    """

    def __init__(self) -> None:
        self._handler: SyncCallback | None = None

    def register_handler(self, handler: SyncCallback) -> None:
        self._handler = handler

    async def emit(
        self,
        db: AsyncDatabase,
        *,
        entity_type: str,
        entity_id: str,
        action: str,
        payload: dict[str, Any] | None = None,
    ) -> str:
        now = datetime.now(timezone.utc)
        job_doc: dict[str, Any] = {
            "job_type": "SINGLE_EVENT",
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "action": action,
            "status": "PENDING",
            "retry_count": 0,
            "total_items": 1,
            "processed_items": 0,
            "payload": payload,
            "error_message": None,
            "created_at": now,
            "updated_at": now,
        }
        result = await db.sync_jobs.insert_one(job_doc)
        job_id = result.inserted_id

        if self._handler is None:
            return str(job_id)

        try:
            await db.sync_jobs.update_one(
                {"_id": job_id},
                {"$set": {"status": "RUNNING", "updated_at": datetime.now(timezone.utc)}},
            )
            await self._handler({**job_doc, "_id": str(job_id)})
            await db.sync_jobs.update_one(
                {"_id": job_id},
                {
                    "$set": {
                        "status": "SUCCESS",
                        "processed_items": 1,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
        except Exception as exc:
            logger.warning("Neo4j sync hook failed for %s:%s (%s): %s", entity_type, entity_id, action, exc)
            await db.sync_jobs.update_one(
                {"_id": job_id},
                {
                    "$set": {
                        "status": "FAILED",
                        "error_message": str(exc)[:500],
                        "updated_at": datetime.now(timezone.utc),
                    },
                    "$inc": {"retry_count": 1},
                },
            )
        return str(job_id)


class CacheHookProvider:
    """
    Integration contract between TV1 (Core APIs & Auth) and TV3 (Redis Cache, Trending,
    Recently Watched, JWT Blacklist).

    TV3 replaces or subclasses this provider and calls `set_cache_provider(...)`.
    Every method is fail-safe: if Redis is unavailable, reads fall back to MongoDB with
    `X-Cache: BYPASS` and blacklist checks fail-open with a warning so read APIs never crash.
    """

    async def get_json(self, key: str) -> tuple[Any | None, str]:
        """Return (value, cache_status) where cache_status is HIT | MISS | BYPASS."""
        return None, "BYPASS"

    async def set_json(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        return None

    async def invalidate_movie(self, movie_id: str) -> None:
        return None

    async def invalidate_movie_lists(self) -> None:
        return None

    async def record_movie_view(self, movie_id: str, user_id: str | None = None) -> None:
        return None

    async def is_token_blacklisted(self, jti: str) -> bool:
        return False

    async def blacklist_token(self, jti: str, expires_in_seconds: int) -> None:
        return None


sync_hooks = SyncHookRegistry()
_cache_provider: CacheHookProvider = CacheHookProvider()


def get_cache_provider() -> CacheHookProvider:
    return _cache_provider


def set_cache_provider(provider: CacheHookProvider) -> None:
    global _cache_provider
    _cache_provider = provider
