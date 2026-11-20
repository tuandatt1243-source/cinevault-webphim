from __future__ import annotations

import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import mongo_manager
from app.services.poster_service import POSTERS_DIR, fetch_image_bytes, get_cached_poster_path


async def cache_all_posters(concurrency: int = 12) -> None:
    POSTERS_DIR.mkdir(parents=True, exist_ok=True)
    db = await mongo_manager.connect()
    try:
        cursor = db.movies.find(
            {"is_deleted": False, "poster_url": {"$ne": None}},
            {"_id": 1, "title": 1, "poster_url": 1},
        ).sort([("avg_rating", -1), ("rating_count", -1)])
        movies = await cursor.to_list(length=None)

        sem = asyncio.Semaphore(concurrency)
        stats = {"cached": 0, "downloaded": 0, "failed": 0}

        async def worker(doc: dict) -> None:
            mid = str(doc["_id"])
            path = get_cached_poster_path(mid)
            if path.exists() and path.stat().st_size > 500:
                stats["cached"] += 1
                return
            async with sem:
                res = await fetch_image_bytes(doc["poster_url"], retries=5)
                if res is not None:
                    data, _ = res
                    tmp = path.with_suffix(".tmp")
                    tmp.write_bytes(data)
                    tmp.replace(path)
                    stats["downloaded"] += 1
                else:
                    stats["failed"] += 1

        await asyncio.gather(*(worker(m) for m in movies))
        print(
            f"Poster cache complete ({len(movies)} movies): "
            f"already_cached={stats['cached']}, newly_downloaded={stats['downloaded']}, failed={stats['failed']}"
        )
    finally:
        await mongo_manager.close()


if __name__ == "__main__":
    asyncio.run(cache_all_posters())
