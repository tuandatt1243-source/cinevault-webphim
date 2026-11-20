from __future__ import annotations

import asyncio
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase


async def get_admin_stats(db: AsyncDatabase) -> dict[str, Any]:
    """Comprehensive MongoDB Aggregation dashboard analytics for TV1 Admin UI."""
    (
        total_movies,
        deleted_movies,
        total_users,
        active_users,
        total_reviews,
        hidden_reviews,
        total_interactions,
        rating_agg,
        genre_agg,
        top_movies_docs,
        decade_agg,
        sync_agg,
        recent_reviews_docs,
    ) = await asyncio.gather(
        db.movies.count_documents({"is_deleted": False}),
        db.movies.count_documents({"is_deleted": True}),
        db.users.count_documents({}),
        db.users.count_documents({"is_active": True}),
        db.reviews.count_documents({}),
        db.reviews.count_documents({"is_hidden": True}),
        db.interactions.count_documents({}),
        _aggregate_rating_distribution(db),
        _aggregate_top_genres(db),
        _fetch_top_rated_movies(db),
        _aggregate_movies_by_decade(db),
        _aggregate_sync_jobs(db),
        _fetch_recent_reviews(db),
    )

    visible_total = sum(b["count"] for b in rating_agg)
    weighted_sum = sum(b["rating"] * b["count"] for b in rating_agg)
    global_avg = round(weighted_sum / visible_total, 2) if visible_total > 0 else 0.0

    buckets_by_rating = {b["rating"]: b["count"] for b in rating_agg}
    rating_distribution = [
        {
            "rating": star,
            "count": buckets_by_rating.get(star, 0),
            "percentage": round((buckets_by_rating.get(star, 0) / visible_total) * 100, 1)
            if visible_total > 0
            else 0.0,
        }
        for star in (5, 4, 3, 2, 1)
    ]

    sync_map = {s["_id"]: int(s["count"]) for s in sync_agg}

    return {
        "kpis": {
            "total_movies": total_movies,
            "deleted_movies": deleted_movies,
            "total_users": total_users,
            "active_users": active_users,
            "total_reviews": total_reviews,
            "hidden_reviews": hidden_reviews,
            "total_interactions": total_interactions,
            "global_avg_rating": global_avg,
        },
        "rating_distribution": rating_distribution,
        "top_genres": genre_agg,
        "top_rated_movies": top_movies_docs,
        "movies_by_decade": decade_agg,
        "sync_jobs": {
            "pending": sync_map.get("PENDING", 0),
            "running": sync_map.get("RUNNING", 0),
            "success": sync_map.get("SUCCESS", 0),
            "failed": sync_map.get("FAILED", 0),
        },
        "recent_reviews": recent_reviews_docs,
    }


async def _aggregate_rating_distribution(db: AsyncDatabase) -> list[dict[str, Any]]:
    pipeline = [
        {"$match": {"is_hidden": False}},
        {"$group": {"_id": "$rating", "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "rating": "$_id", "count": 1}},
    ]
    cursor = await db.reviews.aggregate(pipeline)
    return await cursor.to_list(length=10)


async def _aggregate_top_genres(db: AsyncDatabase) -> list[dict[str, Any]]:
    pipeline = [
        {"$match": {"is_deleted": False}},
        {"$unwind": "$genres"},
        {
            "$group": {
                "_id": "$genres",
                "movie_count": {"$sum": 1},
                "avg_rating": {"$avg": "$avg_rating"},
                "total_views": {"$sum": "$views_count"},
            }
        },
        {"$sort": {"movie_count": -1, "avg_rating": -1}},
        {"$limit": 10},
        {
            "$project": {
                "_id": 0,
                "genre": "$_id",
                "movie_count": 1,
                "avg_rating": {"$round": ["$avg_rating", 2]},
                "total_views": 1,
            }
        },
    ]
    cursor = await db.movies.aggregate(pipeline)
    return await cursor.to_list(length=10)


async def _fetch_top_rated_movies(db: AsyncDatabase) -> list[dict[str, Any]]:
    cursor = (
        db.movies.find(
            {"is_deleted": False, "rating_count": {"$gte": 1}},
            {
                "title": 1,
                "release_year": 1,
                "poster_url": 1,
                "genres": 1,
                "avg_rating": 1,
                "rating_count": 1,
                "views_count": 1,
            },
        )
        .sort([("avg_rating", -1), ("rating_count", -1)])
        .limit(8)
    )
    docs = await cursor.to_list(length=8)
    return [
        {
            "id": str(d["_id"]),
            "title": d["title"],
            "release_year": int(d["release_year"]),
            "poster_url": d.get("poster_url"),
            "genres": list(d.get("genres", [])),
            "avg_rating": round(float(d.get("avg_rating", 0.0)), 2),
            "rating_count": int(d.get("rating_count", 0)),
            "views_count": int(d.get("views_count", 0)),
        }
        for d in docs
    ]


async def _aggregate_movies_by_decade(db: AsyncDatabase) -> list[dict[str, Any]]:
    pipeline = [
        {"$match": {"is_deleted": False}},
        {
            "$project": {
                "decade_num": {
                    "$multiply": [{"$floor": {"$divide": ["$release_year", 10]}}, 10]
                }
            }
        },
        {"$group": {"_id": "$decade_num", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    cursor = await db.movies.aggregate(pipeline)
    rows = await cursor.to_list(length=20)
    return [{"decade": f"{int(r['_id'])}s", "count": int(r["count"])} for r in rows]


async def _aggregate_sync_jobs(db: AsyncDatabase) -> list[dict[str, Any]]:
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    cursor = await db.sync_jobs.aggregate(pipeline)
    return await cursor.to_list(length=10)


async def _fetch_recent_reviews(db: AsyncDatabase) -> list[dict[str, Any]]:
    pipeline = [
        {"$sort": {"created_at": -1}},
        {"$limit": 6},
        {
            "$lookup": {
                "from": "movies",
                "localField": "movie_id",
                "foreignField": "_id",
                "as": "movie_doc",
            }
        },
        {"$unwind": {"path": "$movie_doc", "preserveNullAndEmptyArrays": True}},
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "_id",
                "as": "user_doc",
            }
        },
        {"$unwind": {"path": "$user_doc", "preserveNullAndEmptyArrays": True}},
        {
            "$project": {
                "movie_id": 1,
                "movie_title": {"$ifNull": ["$movie_doc.title", "Untitled"]},
                "user_name": {"$ifNull": ["$user_doc.full_name", "Anonymous"]},
                "rating": 1,
                "comment": 1,
                "is_hidden": 1,
                "created_at": 1,
            }
        },
    ]
    cursor = await db.reviews.aggregate(pipeline)
    rows = await cursor.to_list(length=6)
    return [
        {
            "id": str(r["_id"]),
            "movie_id": str(r["movie_id"]),
            "movie_title": r["movie_title"],
            "user_name": r["user_name"],
            "rating": int(r["rating"]),
            "comment": r.get("comment", ""),
            "is_hidden": bool(r.get("is_hidden", False)),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


async def get_recent_sync_jobs_and_indexes(db: AsyncDatabase, limit: int = 12) -> dict[str, Any]:
    cursor = db.sync_jobs.find({}).sort("created_at", -1).limit(limit)
    jobs = await cursor.to_list(length=limit)

    collections = ["movies", "users", "reviews", "interactions", "sync_jobs", "chat_sessions"]
    index_summary: list[dict[str, Any]] = []
    for col in collections:
        info = await db[col].index_information()
        index_summary.append(
            {
                "collection": col,
                "index_count": len(info),
                "indexes": sorted(list(info.keys())),
            }
        )

    return {
        "jobs": [
            {
                "id": str(j["_id"]),
                "job_type": j.get("job_type", "SINGLE_EVENT"),
                "entity_type": j["entity_type"],
                "entity_id": j["entity_id"],
                "action": j["action"],
                "status": j["status"],
                "retry_count": int(j.get("retry_count", 0)),
                "error_message": j.get("error_message"),
                "created_at": j["created_at"],
            }
            for j in jobs
        ],
        "indexes": index_summary,
    }

