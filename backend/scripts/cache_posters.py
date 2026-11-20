from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import mongo_manager
from app.services.poster_service import (
    POSTERS_DIR,
    fetch_image_bytes,
    get_cached_poster_path,
    lookup_fresh_imdb_poster,
)

OVERRIDES_PATH = BACKEND_DIR / "data" / "poster_overrides.json"


async def cache_all_posters(concurrency: int = 8) -> None:
    POSTERS_DIR.mkdir(parents=True, exist_ok=True)
    overrides: dict[str, str] = {}
    if OVERRIDES_PATH.exists():
        try:
            overrides = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
        except Exception:
            overrides = {}

    db = await mongo_manager.connect()
    try:
        cursor = db.movies.find(
            {"is_deleted": False},
            {"_id": 1, "slug": 1, "title": 1, "release_year": 1, "poster_url": 1},
        ).sort([("avg_rating", -1), ("rating_count", -1)])
        movies = await cursor.to_list(length=None)

        sem = asyncio.Semaphore(concurrency)
        stats = {"cached": 0, "downloaded": 0, "healed": 0, "failed": 0}
        failed_titles: list[str] = []

        async def worker(doc: dict) -> None:
            mid = str(doc["_id"])
            slug = doc.get("slug", "")
            path = get_cached_poster_path(mid)
            if path.exists() and path.stat().st_size > 500:
                stats["cached"] += 1
                return
            async with sem:
                res = await fetch_image_bytes(doc.get("poster_url") or "", retries=3)
                healed = False
                if res is None and doc.get("title"):
                    fresh_url = await lookup_fresh_imdb_poster(doc["title"], doc.get("release_year"))
                    if fresh_url:
                        res = await fetch_image_bytes(fresh_url, retries=4)
                        if res is not None:
                            healed = True
                            if slug:
                                overrides[slug] = fresh_url
                            await db.movies.update_one(
                                {"_id": doc["_id"]},
                                {"$set": {"poster_url": fresh_url, "backdrop_url": fresh_url}},
                            )
                if res is not None:
                    data, _ = res
                    tmp = path.with_suffix(".tmp")
                    tmp.write_bytes(data)
                    tmp.replace(path)
                    if healed:
                        stats["healed"] += 1
                    else:
                        stats["downloaded"] += 1
                else:
                    stats["failed"] += 1
                    failed_titles.append(f"{doc.get('title')} ({doc.get('release_year')})")

        await asyncio.gather(*(worker(m) for m in movies))

        if overrides:
            OVERRIDES_PATH.write_text(
                json.dumps(dict(sorted(overrides.items())), indent=2, ensure_ascii=False),
                encoding="utf-8",
            )

        print(
            f"Poster cache complete ({len(movies)} movies): "
            f"already_cached={stats['cached']}, newly_downloaded={stats['downloaded']}, "
            f"auto_healed={stats['healed']}, failed={stats['failed']}"
        )
        if failed_titles:
            print("Still missing:", failed_titles[:15])
    finally:
        await mongo_manager.close()


if __name__ == "__main__":
    asyncio.run(cache_all_posters())
