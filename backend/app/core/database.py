from __future__ import annotations

from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import get_settings


class MongoManager:
    """Async MongoDB connection lifecycle manager (PyMongo Async)."""

    def __init__(self) -> None:
        self._client: AsyncMongoClient | None = None
        self._db: AsyncDatabase | None = None

    async def connect(self, uri: str | None = None, db_name: str | None = None) -> AsyncDatabase:
        settings = get_settings()
        target_uri = uri or settings.mongodb_uri
        target_db = db_name or settings.mongodb_db_name

        if self._client is None:
            self._client = AsyncMongoClient(
                target_uri,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                maxPoolSize=50,
            )
            self._db = self._client[target_db]
        return self._db

    async def close(self) -> None:
        if self._client is not None:
            await self._client.close()
            self._client = None
            self._db = None

    @property
    def db(self) -> AsyncDatabase:
        if self._db is None:
            raise RuntimeError("MongoDB is not connected. Call connect() during startup.")
        return self._db

    async def ping(self) -> bool:
        try:
            await self.db.command("ping")
            return True
        except Exception:
            return False


mongo_manager = MongoManager()


def get_db() -> AsyncDatabase:
    return mongo_manager.db
