from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import mongo_manager
from app.db.schemas import ensure_collections_and_indexes
from app.services.translate_service import translate_text_free

OVERVIEW_VI_PATH = BACKEND_DIR / "data" / "overview_vi.json"


async def pretranslate_top_movies(limit: int = 80, concurrency: int = 8) -> None:
    saved: dict[str, str] = {}
    if OVERVIEW_VI_PATH.exists():
        try:
            saved = json.loads(OVERVIEW_VI_PATH.read_text(encoding="utf-8"))
        except Exception:
            saved = {}

    db = await mongo_manager.connect()
    try:
        await ensure_collections_and_indexes(db)
        cursor = (
            db.movies.find(
                {"is_deleted": False},
                {"_id": 1, "slug": 1, "overview": 1, "overview_i18n": 1},
            )
            .sort([("avg_rating", -1), ("rating_count", -1)])
            .limit(limit)
        )
        movies = await cursor.to_list(length=limit)
        sem = asyncio.Semaphore(concurrency)
        stats = {"already": 0, "translated": 0, "failed": 0}

        async def worker(doc: dict) -> None:
            slug = doc["slug"]
            existing = (doc.get("overview_i18n") or {}).get("vi") or saved.get(slug)
            if existing:
                if not (doc.get("overview_i18n") or {}).get("vi"):
                    await db.movies.update_one({"_id": doc["_id"]}, {"$set": {"overview_i18n.vi": existing}})
                saved[slug] = existing
                stats["already"] += 1
                return
            async with sem:
                vi_text = await translate_text_free(doc.get("overview", ""), "vi")
                if vi_text:
                    saved[slug] = vi_text
                    await db.movies.update_one({"_id": doc["_id"]}, {"$set": {"overview_i18n.vi": vi_text}})
                    stats["translated"] += 1
                else:
                    stats["failed"] += 1

        await asyncio.gather(*(worker(m) for m in movies))
        OVERVIEW_VI_PATH.write_text(
            json.dumps(dict(sorted(saved.items())), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"Pre-translated top {len(movies)} movies to Vietnamese: {stats}")
    finally:
        await mongo_manager.close()


if __name__ == "__main__":
    asyncio.run(pretranslate_top_movies())
