from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Titofilm API"
    api_v1_prefix: str = "/api/v1"

    # MongoDB (TV1 - Source of Truth)
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "cinevault"

    # Auth / JWT (TV1)
    jwt_secret_key: str = "cinevault-local-dev-secret-key-please-change-for-production-2026"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440

    # Neo4j (TV2)
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "cinevault_neo4j_pass"

    # Redis (TV3)
    redis_url: str = "redis://localhost:6379/0"
    redis_connect_timeout_seconds: float = 1.0

    # CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Seed defaults
    seed_movie_limit: int = 2000
    seed_user_count: int = 220
    seed_review_target: int = 8800

    # Tito Concierge AI (Optional Gemini 3.5 Flash-Lite / Groq RAG over MongoDB)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
