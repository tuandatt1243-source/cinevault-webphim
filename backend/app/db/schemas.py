from __future__ import annotations

from typing import Any

from pymongo import ASCENDING, DESCENDING, TEXT, IndexModel
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import CollectionInvalid, OperationFailure


COLLECTION_VALIDATORS: dict[str, dict[str, Any]] = {
    "users": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "email",
                "password_hash",
                "full_name",
                "role",
                "is_active",
                "favorite_genres",
                "watchlist",
                "created_at",
                "updated_at",
            ],
            "properties": {
                "_id": {"bsonType": "objectId"},
                "email": {
                    "bsonType": "string",
                    "pattern": r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
                    "maxLength": 255,
                },
                "password_hash": {"bsonType": "string", "minLength": 20},
                "full_name": {"bsonType": "string", "minLength": 1, "maxLength": 120},
                "role": {"enum": ["user", "admin"]},
                "is_active": {"bsonType": "bool"},
                "avatar_url": {"bsonType": ["string", "null"]},
                "bio": {"bsonType": ["string", "null"], "maxLength": 500},
                "favorite_genres": {
                    "bsonType": "array",
                    "items": {"bsonType": "string"},
                },
                "watchlist": {
                    "bsonType": "array",
                    "items": {"bsonType": "objectId"},
                },
                "created_at": {"bsonType": "date"},
                "updated_at": {"bsonType": "date"},
            },
        }
    },
    "movies": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "slug",
                "title",
                "overview",
                "release_year",
                "runtime_minutes",
                "genres",
                "cast",
                "directors",
                "avg_rating",
                "rating_count",
                "views_count",
                "is_deleted",
                "created_at",
                "updated_at",
            ],
            "properties": {
                "_id": {"bsonType": "objectId"},
                "slug": {"bsonType": "string", "minLength": 1, "maxLength": 160},
                "title": {"bsonType": "string", "minLength": 1, "maxLength": 250},
                "original_title": {"bsonType": ["string", "null"], "maxLength": 250},
                "overview": {"bsonType": "string", "maxLength": 4000},
                "overview_i18n": {"bsonType": ["object", "null"]},
                "release_year": {"bsonType": "int", "minimum": 1888, "maximum": 2100},
                "runtime_minutes": {"bsonType": "int", "minimum": 1, "maximum": 1000},
                "certificate": {"bsonType": ["string", "null"], "maxLength": 32},
                "poster_url": {"bsonType": ["string", "null"]},
                "backdrop_url": {"bsonType": ["string", "null"]},
                "trailer_url": {"bsonType": ["string", "null"]},
                "genres": {
                    "bsonType": "array",
                    "minItems": 1,
                    "items": {"bsonType": "string"},
                },
                "cast": {
                    "bsonType": "array",
                    "items": {"bsonType": "string"},
                },
                "directors": {
                    "bsonType": "array",
                    "items": {"bsonType": "string"},
                },
                "language": {"bsonType": ["string", "null"], "maxLength": 64},
                "country": {"bsonType": ["string", "null"], "maxLength": 64},
                "imdb_rating": {"bsonType": ["double", "int", "null"], "minimum": 0, "maximum": 10},
                "meta_score": {"bsonType": ["int", "null"], "minimum": 0, "maximum": 100},
                "avg_rating": {"bsonType": ["double", "int"], "minimum": 0, "maximum": 5},
                "rating_count": {"bsonType": "int", "minimum": 0},
                "views_count": {"bsonType": "int", "minimum": 0},
                "is_deleted": {"bsonType": "bool"},
                "deleted_at": {"bsonType": ["date", "null"]},
                "created_at": {"bsonType": "date"},
                "updated_at": {"bsonType": "date"},
            },
        }
    },
    "reviews": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "user_id",
                "movie_id",
                "rating",
                "comment",
                "is_hidden",
                "created_at",
                "updated_at",
            ],
            "properties": {
                "_id": {"bsonType": "objectId"},
                "user_id": {"bsonType": "objectId"},
                "movie_id": {"bsonType": "objectId"},
                "rating": {"bsonType": "int", "minimum": 1, "maximum": 5},
                "comment": {"bsonType": "string", "maxLength": 2000},
                "is_spoiler": {"bsonType": "bool"},
                "is_hidden": {"bsonType": "bool"},
                "created_at": {"bsonType": "date"},
                "updated_at": {"bsonType": "date"},
            },
        }
    },
    "interactions": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["user_id", "movie_id", "type", "duration_sec", "created_at"],
            "properties": {
                "_id": {"bsonType": "objectId"},
                "user_id": {"bsonType": "objectId"},
                "movie_id": {"bsonType": "objectId"},
                "type": {"enum": ["VIEW", "WATCH", "LIKE", "WATCHLIST_ADD"]},
                "duration_sec": {"bsonType": "int", "minimum": 0},
                "created_at": {"bsonType": "date"},
            },
        }
    },
    "sync_jobs": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": [
                "job_type",
                "entity_type",
                "entity_id",
                "action",
                "status",
                "retry_count",
                "created_at",
                "updated_at",
            ],
            "properties": {
                "_id": {"bsonType": "objectId"},
                "job_type": {"enum": ["SINGLE_EVENT", "FULL_RESYNC"]},
                "entity_type": {"enum": ["movie", "user", "review", "interaction", "all"]},
                "entity_id": {"bsonType": "string"},
                "action": {"enum": ["UPSERT", "DELETE", "RESTORE", "RESYNC"]},
                "status": {"enum": ["PENDING", "RUNNING", "SUCCESS", "FAILED"]},
                "retry_count": {"bsonType": "int", "minimum": 0},
                "total_items": {"bsonType": ["int", "null"], "minimum": 0},
                "processed_items": {"bsonType": ["int", "null"], "minimum": 0},
                "payload": {"bsonType": ["object", "null"]},
                "error_message": {"bsonType": ["string", "null"]},
                "created_at": {"bsonType": "date"},
                "updated_at": {"bsonType": "date"},
            },
        }
    },
}


COLLECTION_INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("email", ASCENDING)], unique=True, name="uq_users_email"),
        IndexModel([("role", ASCENDING), ("is_active", ASCENDING), ("created_at", DESCENDING)], name="idx_users_role_active_created"),
    ],
    "movies": [
        IndexModel([("slug", ASCENDING)], unique=True, name="uq_movies_slug"),
        IndexModel(
            [
                ("title", TEXT),
                ("original_title", TEXT),
                ("overview", TEXT),
                ("cast", TEXT),
                ("directors", TEXT),
            ],
            weights={"title": 10, "original_title": 8, "cast": 5, "directors": 4, "overview": 1},
            default_language="english",
            name="txt_movies_search",
        ),
        IndexModel(
            [("is_deleted", ASCENDING), ("genres", ASCENDING), ("release_year", DESCENDING), ("avg_rating", DESCENDING)],
            name="idx_movies_active_genre_year_rating",
        ),
        IndexModel(
            [("is_deleted", ASCENDING), ("avg_rating", DESCENDING), ("rating_count", DESCENDING)],
            name="idx_movies_active_rating",
        ),
        IndexModel(
            [("is_deleted", ASCENDING), ("views_count", DESCENDING)],
            name="idx_movies_active_views",
        ),
        IndexModel(
            [("is_deleted", ASCENDING), ("created_at", DESCENDING)],
            name="idx_movies_active_created",
        ),
    ],
    "reviews": [
        IndexModel([("user_id", ASCENDING), ("movie_id", ASCENDING)], unique=True, name="uq_reviews_user_movie"),
        IndexModel([("movie_id", ASCENDING), ("is_hidden", ASCENDING), ("created_at", DESCENDING)], name="idx_reviews_movie_visible_created"),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="idx_reviews_user_created"),
        IndexModel([("is_hidden", ASCENDING), ("rating", ASCENDING), ("created_at", DESCENDING)], name="idx_reviews_hidden_rating_created"),
    ],
    "interactions": [
        IndexModel([("user_id", ASCENDING), ("type", ASCENDING), ("created_at", DESCENDING)], name="idx_interactions_user_type_created"),
        IndexModel([("movie_id", ASCENDING), ("type", ASCENDING), ("created_at", DESCENDING)], name="idx_interactions_movie_type_created"),
    ],
    "sync_jobs": [
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="idx_sync_jobs_status_created"),
        IndexModel([("entity_type", ASCENDING), ("entity_id", ASCENDING), ("created_at", DESCENDING)], name="idx_sync_jobs_entity_created"),
    ],
}


async def ensure_collections_and_indexes(db: AsyncDatabase) -> dict[str, list[str]]:
    """
    Idempotently create all 5 collections with strict MongoDB $jsonSchema validation
    and build all Unique, Text, and Compound indexes.
    """
    existing = set(await db.list_collection_names())
    created_indexes: dict[str, list[str]] = {}

    for col_name, validator in COLLECTION_VALIDATORS.items():
        if col_name not in existing:
            try:
                await db.create_collection(
                    col_name,
                    validator=validator,
                    validationLevel="strict",
                    validationAction="error",
                )
            except CollectionInvalid:
                pass
        else:
            try:
                await db.command(
                    {
                        "collMod": col_name,
                        "validator": validator,
                        "validationLevel": "strict",
                        "validationAction": "error",
                    }
                )
            except OperationFailure:
                pass

        indexes = COLLECTION_INDEXES.get(col_name, [])
        if indexes:
            names = await db[col_name].create_indexes(indexes)
            created_indexes[col_name] = names

    return created_indexes
