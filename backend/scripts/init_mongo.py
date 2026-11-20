from __future__ import annotations

import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings
from app.core.database import mongo_manager
from app.db.schemas import ensure_collections_and_indexes


async def main() -> None:
    settings = get_settings()
    db = await mongo_manager.connect()
    try:
        ok = await mongo_manager.ping()
        if not ok:
            raise RuntimeError(f"Cannot connect to MongoDB at {settings.mongodb_uri}")

        created = await ensure_collections_and_indexes(db)
        print(f"MongoDB initialized successfully: db='{settings.mongodb_db_name}'")
        for col_name, idx_names in created.items():
            info = await db[col_name].index_information()
            print(f"  - Collection '{col_name}': {len(info)} indexes ({', '.join(sorted(info.keys()))})")
    finally:
        await mongo_manager.close()


if __name__ == "__main__":
    asyncio.run(main())
