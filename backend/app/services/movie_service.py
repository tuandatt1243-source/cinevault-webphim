from __future__ import annotations

import hashlib
import json
import logging
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from pymongo import DESCENDING, ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core.hooks import get_cache_provider, sync_hooks
from app.core.sanitize import parse_object_id, safe_regex_pattern, sanitize_search_text, slugify
from app.models.movie import MovieCreateRequest, MovieUpdateRequest
from app.services.poster_service import get_cached_poster_path
from app.services.serializers import serialize_movie

logger = logging.getLogger("cinevault.movies")
HD_TRAILERS_PATH = Path(__file__).resolve().parents[2] / "data" / "hd_trailers.json"

ALLOWED_SORTS: dict[str, list[tuple[str, int]]] = {
    "newest": [("release_year", DESCENDING), ("avg_rating", DESCENDING)],
    "created": [("created_at", DESCENDING)],
    "rating": [("avg_rating", DESCENDING), ("rating_count", DESCENDING)],
    "views": [("views_count", DESCENDING), ("avg_rating", DESCENDING)],
    "title": [("title", 1)],
    "year_asc": [("release_year", 1), ("avg_rating", DESCENDING)],
}


async def list_movies(
    db: AsyncDatabase,
    *,
    q: str | None = None,
    genre: str | None = None,
    genres: str | None = None,
    year: int | None = None,
    decade: int | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    max_runtime: int | None = None,
    min_rating: float | None = None,
    min_imdb: float | None = None,
    director: str | None = None,
    actor: str | None = None,
    has_trailer: bool | None = None,
    sort: str = "rating",
    status_filter: str = "active",
    include_deleted: bool = False,
    page: int = 1,
    limit: int = 20,
) -> tuple[dict[str, Any], str]:
    cleaned_q = sanitize_search_text(q)
    cache_provider = get_cache_provider()

    # Only cache public active queries
    cache_status = "BYPASS"
    cache_key: str | None = None
    if not include_deleted and status_filter == "active":
        raw_sig = (
            f"q={cleaned_q}|g={genre}|gs={genres}|y={year}|dec={decade}|yf={year_from}|yt={year_to}|"
            f"mr={max_runtime}|r={min_rating}|im={min_imdb}|d={director}|a={actor}|tr={has_trailer}|"
            f"s={sort}|p={page}|l={limit}"
        )
        cache_key = "movies:list:" + hashlib.md5(raw_sig.encode("utf-8")).hexdigest()
        try:
            cached, cache_status = await cache_provider.get_json(cache_key)
            if cached is not None:
                return cached, cache_status
        except Exception as exc:
            logger.warning("Redis movie list lookup bypassed: %s", exc)
            cache_status = "BYPASS"

    base_filter: dict[str, Any] = {}
    if status_filter == "deleted":
        base_filter["is_deleted"] = True
    elif status_filter == "all" and include_deleted:
        pass
    else:
        base_filter["is_deleted"] = False

    if genre and genre.strip():
        base_filter["genres"] = genre.strip()
    elif genres and genres.strip():
        genre_list = [g.strip() for g in genres.split(",") if g.strip()][:8]
        if genre_list:
            base_filter["genres"] = {"$in": genre_list}

    if year is not None:
        base_filter["release_year"] = int(year)
    else:
        year_range: dict[str, int] = {}
        if decade is not None:
            dec = int(decade)
            if dec <= 1950:
                year_range["$lte"] = 1959
            else:
                year_range["$gte"] = dec
                year_range["$lte"] = dec + 9
        if year_from is not None:
            year_range["$gte"] = int(year_from)
        if year_to is not None:
            year_range["$lte"] = int(year_to)
        if year_range:
            base_filter["release_year"] = year_range

    if max_runtime is not None:
        base_filter["runtime_minutes"] = {"$lte": int(max_runtime)}
    if min_rating is not None:
        base_filter["avg_rating"] = {"$gte": float(min_rating)}
    if min_imdb is not None:
        base_filter["imdb_rating"] = {"$gte": float(min_imdb)}
    if director and director.strip():
        base_filter["directors"] = {"$regex": f"^{safe_regex_pattern(director.strip())}$", "$options": "i"}
    if actor and actor.strip():
        base_filter["cast"] = {"$regex": f"^{safe_regex_pattern(actor.strip())}$", "$options": "i"}
    if has_trailer is True:
        base_filter["trailer_url"] = {"$type": "string", "$ne": ""}

    sort_spec = ALLOWED_SORTS.get(sort, ALLOWED_SORTS["rating"])
    skip = (page - 1) * limit

    used_text_query = False
    query_filter = dict(base_filter)
    if cleaned_q:
        # Primary: MongoDB Text Index search
        text_filter = {**base_filter, "$text": {"$search": cleaned_q}}
        total = await db.movies.count_documents(text_filter)
        if total > 0:
            used_text_query = True
            query_filter = text_filter
        else:
            # Graceful partial-prefix fallback using escaped regex (safe against ReDoS/injection)
            pattern = safe_regex_pattern(cleaned_q)
            query_filter = {
                **base_filter,
                "$or": [
                    {"title": {"$regex": pattern, "$options": "i"}},
                    {"directors": {"$regex": pattern, "$options": "i"}},
                    {"cast": {"$regex": pattern, "$options": "i"}},
                ],
            }
            total = await db.movies.count_documents(query_filter)
    else:
        total = await db.movies.count_documents(query_filter)

    if used_text_query:
        cursor = (
            db.movies.find(query_filter, {"score": {"$meta": "textScore"}})
            .sort([("score", {"$meta": "textScore"}), *sort_spec])
            .skip(skip)
            .limit(limit)
        )
    else:
        cursor = db.movies.find(query_filter).sort(sort_spec).skip(skip).limit(limit)

    docs = await cursor.to_list(length=limit)
    payload = {
        "items": [serialize_movie(d) for d in docs],
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if total > 0 else 0,
        },
    }

    if cache_key is not None and cache_status == "MISS":
        try:
            await cache_provider.set_json(cache_key, payload, ttl_seconds=180)
        except Exception as exc:
            logger.warning("Redis movie list set skipped: %s", exc)

    return payload, cache_status


async def get_movie_detail(
    db: AsyncDatabase,
    movie_id_str: str,
    *,
    include_deleted: bool = False,
    record_view: bool = True,
    viewer_user_id: str | None = None,
) -> tuple[dict[str, Any], str]:
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    cache_provider = get_cache_provider()
    cache_status = "BYPASS"
    cache_key = f"movies:detail:{movie_id_str}"

    if not include_deleted:
        try:
            cached, cache_status = await cache_provider.get_json(cache_key)
            if cached is not None:
                if record_view:
                    await _record_view_side_effects(db, movie_oid, movie_id_str, viewer_user_id)
                return cached, cache_status
        except Exception as exc:
            logger.warning("Redis movie detail lookup bypassed: %s", exc)
            cache_status = "BYPASS"

    query: dict[str, Any] = {"_id": movie_oid}
    if not include_deleted:
        query["is_deleted"] = False

    doc = await db.movies.find_one(query)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")

    if record_view and not doc.get("is_deleted", False):
        await _record_view_side_effects(db, movie_oid, movie_id_str, viewer_user_id)
        doc["views_count"] = int(doc.get("views_count", 0)) + 1

    serialized = serialize_movie(doc)
    if not include_deleted and cache_status == "MISS":
        try:
            await cache_provider.set_json(cache_key, serialized, ttl_seconds=300)
        except Exception as exc:
            logger.warning("Redis movie detail set skipped: %s", exc)

    return serialized, cache_status


async def _record_view_side_effects(
    db: AsyncDatabase,
    movie_oid: Any,
    movie_id_str: str,
    viewer_user_id: str | None,
) -> None:
    await db.movies.update_one({"_id": movie_oid}, {"$inc": {"views_count": 1}})
    if viewer_user_id:
        user_oid = parse_object_id(viewer_user_id, "user_id")
        await db.interactions.insert_one(
            {
                "user_id": user_oid,
                "movie_id": movie_oid,
                "type": "VIEW",
                "duration_sec": 0,
                "created_at": datetime.now(timezone.utc),
            }
        )
    try:
        await get_cache_provider().record_movie_view(movie_id_str, viewer_user_id)
    except Exception as exc:
        logger.warning("Redis record_movie_view skipped: %s", exc)


async def list_genres_facets(db: AsyncDatabase) -> list[dict[str, Any]]:
    pipeline = [
        {"$match": {"is_deleted": False}},
        {"$unwind": "$genres"},
        {"$group": {"_id": "$genres", "count": {"$sum": 1}}},
        {"$sort": {"count": -1, "_id": 1}},
        {"$project": {"_id": 0, "name": "$_id", "count": 1}},
    ]
    cursor = await db.movies.aggregate(pipeline)
    return await cursor.to_list(length=100)


async def list_featured_hd_movies(
    db: AsyncDatabase,
    *,
    kind: str = "billboard",
    limit: int = 8,
) -> list[dict[str, Any]]:
    """Return verified 4K/1080p widescreen studio trailer showcases for Billboard Hero & Reels HD."""
    ordered_slugs: list[str] = []
    if HD_TRAILERS_PATH.exists():
        try:
            cfg = json.loads(HD_TRAILERS_PATH.read_text(encoding="utf-8"))
            ordered_slugs = list(cfg.get("reels_slugs" if kind == "reels" else "billboard_slugs") or [])
        except Exception:
            ordered_slugs = []

    docs_by_slug: dict[str, dict[str, Any]] = {}
    if ordered_slugs:
        found = await db.movies.find(
            {"is_deleted": False, "slug": {"$in": ordered_slugs}}
        ).to_list(length=len(ordered_slugs))
        docs_by_slug = {d["slug"]: d for d in found}

    ordered_docs = [docs_by_slug[s] for s in ordered_slugs if s in docs_by_slug][:limit]

    # Top up gracefully with newest high-view movies if DB is smaller (e.g. unit tests)
    if len(ordered_docs) < limit:
        existing_ids = [d["_id"] for d in ordered_docs]
        extra = (
            await db.movies.find(
                {
                    "is_deleted": False,
                    "_id": {"$nin": existing_ids},
                    "trailer_url": {"$type": "string", "$ne": ""},
                }
            )
            .sort([("release_year", DESCENDING), ("views_count", DESCENDING), ("avg_rating", DESCENDING)])
            .limit(limit - len(ordered_docs))
            .to_list(length=limit - len(ordered_docs))
        )
        ordered_docs.extend(extra)

    return [serialize_movie(d) for d in ordered_docs]


MOOD_FILTERS: dict[str, dict[str, Any]] = {
    "mindbend": {"genres": {"$in": ["Sci-Fi", "Mystery", "Thriller"]}, "avg_rating": {"$gte": 3.8}},
    "emotional": {"genres": {"$in": ["Drama", "Romance", "Biography"]}, "avg_rating": {"$gte": 4.0}},
    "adrenaline": {"genres": {"$in": ["Action", "Adventure", "War"]}},
    "quick": {"runtime_minutes": {"$lte": 100}},
    "classic": {"release_year": {"$lte": 1999}, "imdb_rating": {"$gte": 8.0}},
    "dark": {"genres": {"$in": ["Horror", "Crime", "Film-Noir", "Thriller"]}},
    "animation": {"genres": {"$in": ["Animation", "Family", "Fantasy"]}},
}


async def roulette_movies(
    db: AsyncDatabase,
    *,
    mood: str | None = None,
    max_runtime: int | None = None,
    limit: int = 12,
) -> list[dict[str, Any]]:
    """Return randomized matching movies using MongoDB $sample aggregation for Tito Roulette & Reels."""
    match_filter: dict[str, Any] = {
        "is_deleted": False,
        "trailer_url": {"$type": "string", "$ne": ""},
    }
    if mood and mood in MOOD_FILTERS:
        match_filter.update(MOOD_FILTERS[mood])
    if max_runtime is not None:
        existing_rt = match_filter.get("runtime_minutes")
        if isinstance(existing_rt, dict) and "$lte" in existing_rt:
            match_filter["runtime_minutes"] = {"$lte": min(int(max_runtime), int(existing_rt["$lte"]))}
        else:
            match_filter["runtime_minutes"] = {"$lte": int(max_runtime)}

    pipeline = [
        {"$match": match_filter},
        {"$sample": {"size": max(1, min(limit, 30))}},
    ]
    cursor = await db.movies.aggregate(pipeline)
    docs = await cursor.to_list(length=limit)

    if not docs:
        fallback_cursor = await db.movies.aggregate(
            [
                {"$match": {"is_deleted": False}},
                {"$sample": {"size": max(1, min(limit, 30))}},
            ]
        )
        docs = await fallback_cursor.to_list(length=limit)

    return [serialize_movie(d) for d in docs]


async def list_decades_showcase(db: AsyncDatabase) -> list[dict[str, Any]]:
    """Aggregate movies into cinema eras (1920s–50s through 2020s) for Cinema Time Machine."""
    pipeline = [
        {"$match": {"is_deleted": False}},
        {
            "$addFields": {
                "era_decade": {
                    "$cond": [
                        {"$lte": ["$release_year", 1959]},
                        1950,
                        {"$multiply": [{"$floor": {"$divide": ["$release_year", 10]}}, 10]},
                    ]
                }
            }
        },
        {"$sort": {"views_count": -1, "avg_rating": -1}},
        {
            "$group": {
                "_id": "$era_decade",
                "count": {"$sum": 1},
                "avg_rating": {"$avg": "$avg_rating"},
                "movies": {"$push": "$$ROOT"},
                "all_directors": {"$push": "$directors"},
            }
        },
        {"$sort": {"_id": -1}},
    ]
    cursor = await db.movies.aggregate(pipeline)
    groups = await cursor.to_list(length=20)

    result: list[dict[str, Any]] = []
    for grp in groups:
        dec = int(grp["_id"])
        label = "1920s–1950s" if dec <= 1950 else f"{dec}s"

        director_counts: dict[str, int] = {}
        for d_list in grp.get("all_directors") or []:
            for d_name in d_list or []:
                if d_name:
                    director_counts[d_name] = director_counts.get(d_name, 0) + 1
        top_directors = [
            name for name, _ in sorted(director_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:4]
        ]

        sample_docs = (grp.get("movies") or [])[:10]
        result.append(
            {
                "decade": dec,
                "label": label,
                "count": int(grp["count"]),
                "avg_rating": round(float(grp.get("avg_rating") or 0.0), 2),
                "top_directors": top_directors,
                "sample_movies": [serialize_movie(d) for d in sample_docs],
            }
        )
    return result


async def get_movie_insights(db: AsyncDatabase, movie_id_str: str) -> dict[str, Any]:
    """Compute Letterboxd-style 5-star Rating Histogram & same-director films via MongoDB Aggregation."""
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    movie = await db.movies.find_one({"_id": movie_oid, "is_deleted": False})
    if movie is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")

    hist_pipeline = [
        {"$match": {"movie_id": movie_oid, "is_hidden": False}},
        {"$group": {"_id": "$rating", "count": {"$sum": 1}}},
    ]
    cursor = await db.reviews.aggregate(hist_pipeline)
    raw_buckets = await cursor.to_list(length=10)
    counts_by_star = {int(b["_id"]): int(b["count"]) for b in raw_buckets if b.get("_id") is not None}
    total_reviews = sum(counts_by_star.values())

    histogram = []
    for star in (5, 4, 3, 2, 1):
        cnt = counts_by_star.get(star, 0)
        pct = round((cnt / total_reviews) * 100.0, 1) if total_reviews > 0 else 0.0
        histogram.append({"stars": star, "count": cnt, "percent": pct})

    avg_rating = round(float(movie.get("avg_rating", 0.0)), 2)
    high_ratio = ((counts_by_star.get(5, 0) + counts_by_star.get(4, 0)) / total_reviews) if total_reviews else 0.0
    low_ratio = ((counts_by_star.get(1, 0) + counts_by_star.get(2, 0)) / total_reviews) if total_reviews else 0.0

    if total_reviews < 3:
        consensus = "emerging"
    elif avg_rating >= 4.2 and high_ratio >= 0.78:
        consensus = "acclaimed"
    elif low_ratio >= 0.25 and high_ratio >= 0.45:
        consensus = "divisive"
    elif avg_rating >= 3.6:
        consensus = "favorable"
    else:
        consensus = "mixed"

    more_from_director: list[dict[str, Any]] = []
    directors = movie.get("directors") or []
    if directors:
        dir_cursor = (
            db.movies.find(
                {
                    "_id": {"$ne": movie_oid},
                    "is_deleted": False,
                    "directors": {"$in": directors[:2]},
                }
            )
            .sort([("avg_rating", DESCENDING), ("views_count", DESCENDING)])
            .limit(6)
        )
        dir_docs = await dir_cursor.to_list(length=6)
        more_from_director = [serialize_movie(d) for d in dir_docs]

    return {
        "movie_id": movie_id_str,
        "total_reviews": total_reviews,
        "avg_rating": avg_rating,
        "consensus": consensus,
        "histogram": histogram,
        "more_from_director": more_from_director,
    }


async def get_person_spotlight(db: AsyncDatabase, *, name: str, role: str = "director") -> dict[str, Any]:
    """Return filmography and career metrics for a director or actor from MongoDB."""
    cleaned = sanitize_search_text(name)
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Person name is required.")

    field = "directors" if role == "director" else "cast"
    pattern = f"^{safe_regex_pattern(cleaned)}$"
    docs = (
        await db.movies.find({"is_deleted": False, field: {"$regex": pattern, "$options": "i"}})
        .sort([("avg_rating", DESCENDING), ("release_year", DESCENDING)])
        .limit(60)
        .to_list(length=60)
    )
    if not docs:
        # Graceful substring fallback
        docs = (
            await db.movies.find({"is_deleted": False, field: {"$regex": safe_regex_pattern(cleaned), "$options": "i"}})
            .sort([("avg_rating", DESCENDING), ("release_year", DESCENDING)])
            .limit(60)
            .to_list(length=60)
        )

    movie_count = len(docs)
    avg_rating = round(sum(float(d.get("avg_rating", 0.0)) for d in docs) / movie_count, 2) if movie_count else 0.0
    imdb_vals = [float(d["imdb_rating"]) for d in docs if d.get("imdb_rating") is not None]
    avg_imdb = round(sum(imdb_vals) / len(imdb_vals), 2) if imdb_vals else None

    years = [int(d["release_year"]) for d in docs if d.get("release_year")]
    if years:
        min_y, max_y = min(years), max(years)
        year_span = str(min_y) if min_y == max_y else f"{min_y}–{max_y}"
    else:
        year_span = "—"

    genre_counts: dict[str, int] = {}
    for d in docs:
        for g in d.get("genres") or []:
            genre_counts[g] = genre_counts.get(g, 0) + 1
    top_genres = [g for g, _ in sorted(genre_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:4]]

    return {
        "name": cleaned,
        "role": "director" if role == "director" else "actor",
        "movie_count": movie_count,
        "avg_rating": avg_rating,
        "avg_imdb": avg_imdb,
        "year_span": year_span,
        "top_genres": top_genres,
        "movies": [serialize_movie(d) for d in docs],
    }


async def create_movie(db: AsyncDatabase, payload: MovieCreateRequest) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    base_slug = payload.slug.strip().lower() if payload.slug else slugify(payload.title, payload.release_year)

    doc = {
        "slug": base_slug,
        "title": payload.title,
        "original_title": payload.original_title,
        "overview": payload.overview,
        "release_year": int(payload.release_year),
        "runtime_minutes": int(payload.runtime_minutes),
        "certificate": payload.certificate,
        "poster_url": payload.poster_url,
        "backdrop_url": payload.backdrop_url,
        "trailer_url": payload.trailer_url,
        "genres": payload.genres,
        "cast": payload.cast,
        "directors": payload.directors,
        "language": payload.language,
        "country": payload.country,
        "imdb_rating": float(payload.imdb_rating) if payload.imdb_rating is not None else None,
        "meta_score": int(payload.meta_score) if payload.meta_score is not None else None,
        "avg_rating": 0.0,
        "rating_count": 0,
        "views_count": 0,
        "is_deleted": False,
        "deleted_at": None,
        "created_at": now,
        "updated_at": now,
    }

    try:
        res = await db.movies.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A movie with slug '{base_slug}' already exists.",
        ) from exc

    doc["_id"] = res.inserted_id
    serialized = serialize_movie(doc)

    await sync_hooks.emit(
        db,
        entity_type="movie",
        entity_id=serialized["id"],
        action="UPSERT",
        payload={
            "title": serialized["title"],
            "release_year": serialized["release_year"],
            "genres": serialized["genres"],
            "cast": serialized["cast"],
            "directors": serialized["directors"],
        },
    )
    await _invalidate_movie_caches_safe(serialized["id"])
    return serialized


async def update_movie(
    db: AsyncDatabase,
    movie_id_str: str,
    payload: MovieUpdateRequest,
) -> dict[str, Any]:
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        existing = await db.movies.find_one({"_id": movie_oid})
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")
        return serialize_movie(existing)

    if "imdb_rating" in updates and updates["imdb_rating"] is not None:
        updates["imdb_rating"] = float(updates["imdb_rating"])
    updates["updated_at"] = datetime.now(timezone.utc)

    updated = await db.movies.find_one_and_update(
        {"_id": movie_oid},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")

    if "poster_url" in updates:
        get_cached_poster_path(movie_id_str).unlink(missing_ok=True)

    serialized = serialize_movie(updated)
    await sync_hooks.emit(
        db,
        entity_type="movie",
        entity_id=serialized["id"],
        action="UPSERT",
        payload={
            "title": serialized["title"],
            "release_year": serialized["release_year"],
            "genres": serialized["genres"],
            "cast": serialized["cast"],
            "directors": serialized["directors"],
            "replace_relations": True,
        },
    )
    await _invalidate_movie_caches_safe(serialized["id"])
    return serialized


async def soft_delete_movie(db: AsyncDatabase, movie_id_str: str) -> dict[str, Any]:
    """Soft-delete movie (is_deleted=True, deleted_at=now) and notify Neo4j + Redis hooks."""
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    now = datetime.now(timezone.utc)
    updated = await db.movies.find_one_and_update(
        {"_id": movie_oid, "is_deleted": False},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        existing = await db.movies.find_one({"_id": movie_oid})
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Movie is already archived/deleted.")

    await sync_hooks.emit(
        db,
        entity_type="movie",
        entity_id=movie_id_str,
        action="DELETE",
        payload={"soft_deleted": True},
    )
    await _invalidate_movie_caches_safe(movie_id_str)
    return serialize_movie(updated)


async def restore_movie(db: AsyncDatabase, movie_id_str: str) -> dict[str, Any]:
    """Restore a soft-deleted movie back into the active catalog and re-trigger Neo4j sync."""
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    now = datetime.now(timezone.utc)
    updated = await db.movies.find_one_and_update(
        {"_id": movie_oid, "is_deleted": True},
        {"$set": {"is_deleted": False, "deleted_at": None, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        existing = await db.movies.find_one({"_id": movie_oid})
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Movie is already active.")

    serialized = serialize_movie(updated)
    await sync_hooks.emit(
        db,
        entity_type="movie",
        entity_id=serialized["id"],
        action="RESTORE",
        payload={
            "title": serialized["title"],
            "release_year": serialized["release_year"],
            "genres": serialized["genres"],
            "cast": serialized["cast"],
            "directors": serialized["directors"],
        },
    )
    await _invalidate_movie_caches_safe(serialized["id"])
    return serialized


async def _invalidate_movie_caches_safe(movie_id: str) -> None:
    try:
        provider = get_cache_provider()
        await provider.invalidate_movie(movie_id)
        await provider.invalidate_movie_lists()
    except Exception as exc:
        logger.warning("Redis cache invalidation skipped: %s", exc)
