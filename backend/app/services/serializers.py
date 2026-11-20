from __future__ import annotations

from typing import Any


def serialize_user(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "full_name": doc["full_name"],
        "role": doc["role"],
        "is_active": bool(doc.get("is_active", True)),
        "avatar_url": doc.get("avatar_url"),
        "bio": doc.get("bio"),
        "favorite_genres": list(doc.get("favorite_genres", [])),
        "watchlist": [str(mid) for mid in doc.get("watchlist", [])],
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


def serialize_movie(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "slug": doc["slug"],
        "title": doc["title"],
        "original_title": doc.get("original_title"),
        "overview": doc.get("overview", ""),
        "release_year": int(doc["release_year"]),
        "runtime_minutes": int(doc["runtime_minutes"]),
        "certificate": doc.get("certificate"),
        "poster_url": doc.get("poster_url"),
        "backdrop_url": doc.get("backdrop_url"),
        "trailer_url": doc.get("trailer_url"),
        "genres": list(doc.get("genres", [])),
        "cast": list(doc.get("cast", [])),
        "directors": list(doc.get("directors", [])),
        "language": doc.get("language"),
        "country": doc.get("country"),
        "imdb_rating": float(doc["imdb_rating"]) if doc.get("imdb_rating") is not None else None,
        "meta_score": int(doc["meta_score"]) if doc.get("meta_score") is not None else None,
        "avg_rating": round(float(doc.get("avg_rating", 0.0)), 2),
        "rating_count": int(doc.get("rating_count", 0)),
        "views_count": int(doc.get("views_count", 0)),
        "is_deleted": bool(doc.get("is_deleted", False)),
        "deleted_at": doc.get("deleted_at"),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


def serialize_review(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "user_id": str(doc["user_id"]),
        "user_name": doc.get("user_name"),
        "user_email": doc.get("user_email"),
        "movie_id": str(doc["movie_id"]),
        "movie_title": doc.get("movie_title"),
        "movie_poster_url": doc.get("movie_poster_url"),
        "rating": int(doc["rating"]),
        "comment": doc.get("comment", ""),
        "is_hidden": bool(doc.get("is_hidden", False)),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


def serialize_interaction(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "user_id": str(doc["user_id"]),
        "movie_id": str(doc["movie_id"]),
        "type": doc["type"],
        "duration_sec": int(doc.get("duration_sec", 0)),
        "created_at": doc["created_at"],
    }
