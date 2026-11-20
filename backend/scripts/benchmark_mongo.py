from __future__ import annotations

import asyncio
import json
import random
import statistics
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, IndexModel

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import mongo_manager


def _extract_winning_stage(plan: dict[str, Any]) -> str:
    if not isinstance(plan, dict):
        return "UNKNOWN"
    stage = plan.get("stage", "")
    if stage in ("IXSCAN", "COLLSCAN", "TEXT_MATCH", "TEXT_OR", "TEXT"):
        return stage
    for child_key in ("inputStage", "queryPlan"):
        if child_key in plan:
            found = _extract_winning_stage(plan[child_key])
            if found != "UNKNOWN":
                return found
    for child_list_key in ("inputStages", "shards"):
        if child_list_key in plan and isinstance(plan[child_list_key], list):
            for child in plan[child_list_key]:
                found = _extract_winning_stage(child)
                if found != "UNKNOWN":
                    return found
    return stage or "UNKNOWN"


async def run_explain_and_time(
    db: Any,
    col_name: str,
    query: dict[str, Any],
    sort: list[tuple[str, int]] | None = None,
    hint: Any = None,
    limit: int = 20,
    runs: int = 30,
) -> dict[str, Any]:
    col = db[col_name]

    def build_cursor():
        cur = col.find(query)
        if sort:
            cur = cur.sort(sort)
        if hint is not None:
            cur = cur.hint(hint)
        if limit:
            cur = cur.limit(limit)
        return cur

    # Run explain("executionStats")
    explain_cmd: dict[str, Any] = {
        "explain": {
            "find": col_name,
            "filter": query,
            "limit": limit,
        },
        "verbosity": "executionStats",
    }
    if sort:
        explain_cmd["explain"]["sort"] = dict(sort)
    if hint is not None:
        explain_cmd["explain"]["hint"] = hint

    explain_res = await db.command(explain_cmd)
    exec_stats = explain_res.get("executionStats", {})
    winning_plan = explain_res.get("queryPlanner", {}).get("winningPlan", {})
    stage = _extract_winning_stage(winning_plan)

    # Measure wall-clock latency across N runs (warm)
    timings_ms: list[float] = []
    for _ in range(runs):
        t0 = time.perf_counter()
        _ = await build_cursor().to_list(length=limit)
        timings_ms.append((time.perf_counter() - t0) * 1000.0)

    return {
        "stage": stage,
        "nReturned": int(exec_stats.get("nReturned", 0)),
        "totalKeysExamined": int(exec_stats.get("totalKeysExamined", 0)),
        "totalDocsExamined": int(exec_stats.get("totalDocsExamined", 0)),
        "explainExecMs": float(exec_stats.get("executionTimeMillis", 0)),
        "avgClientMs": round(statistics.mean(timings_ms), 3),
        "p95ClientMs": round(sorted(timings_ms)[int(len(timings_ms) * 0.95) - 1], 3),
    }


async def benchmark_scaled_reviews_50k(db: Any) -> dict[str, Any]:
    """
    Create a temporary 50,000-document review benchmark collection to clearly prove
    IXSCAN vs COLLSCAN scaling behavior, then drop it cleanly.
    """
    col_name = "_bench_reviews_50k"
    col = db[col_name]
    await col.drop()

    rng = random.Random(42)
    movie_ids = [ObjectId() for _ in range(500)]
    target_movie = movie_ids[0]
    base_ts = datetime(2025, 1, 1, tzinfo=timezone.utc)

    docs = []
    for i in range(50_000):
        docs.append(
            {
                "movie_id": movie_ids[i % 500],
                "user_id": ObjectId(),
                "rating": rng.randint(1, 5),
                "is_hidden": (i % 53 == 0),
                "comment": f"Benchmark synthetic review payload #{i} for MongoDB index vs COLLSCAN test.",
                "created_at": base_ts + timedelta(seconds=i * 30),
            }
        )
    await col.insert_many(docs, ordered=False)
    await col.create_indexes(
        [
            IndexModel(
                [("movie_id", ASCENDING), ("is_hidden", ASCENDING), ("created_at", DESCENDING)],
                name="idx_bench_movie_hidden_created",
            )
        ]
    )

    query = {"movie_id": target_movie, "is_hidden": False}
    sort = [("created_at", DESCENDING)]
    ix = await run_explain_and_time(db, col_name, query, sort=sort, hint="idx_bench_movie_hidden_created", limit=20, runs=30)
    cs = await run_explain_and_time(db, col_name, query, sort=sort, hint={"$natural": 1}, limit=20, runs=30)

    await col.drop()
    return {
        "case": "50,000 Reviews Scale Test (movie_id + is_hidden + sort created_at)",
        "collection": col_name,
        "docs_in_collection": 50_000,
        "indexed": ix,
        "collscan": cs,
        "speedup_x": round(cs["avgClientMs"] / max(ix["avgClientMs"], 0.001), 2),
    }


async def main() -> None:
    db = await mongo_manager.connect()
    try:
        sample_movie = await db.movies.find_one({"is_deleted": False}, sort=[("rating_count", -1)])
        if sample_movie is None:
            raise RuntimeError("No seeded movies found. Run seed_mongo.py first.")

        cases: list[dict[str, Any]] = []

        # Case 1: Movies Compound Index (is_deleted + genres + release_year + sort avg_rating)
        q1 = {"is_deleted": False, "genres": "Drama", "release_year": {"$gte": 2000}}
        s1 = [("avg_rating", DESCENDING)]
        ix1 = await run_explain_and_time(db, "movies", q1, sort=s1, hint="idx_movies_active_genre_year_rating", limit=20)
        cs1 = await run_explain_and_time(db, "movies", q1, sort=s1, hint={"$natural": 1}, limit=20)
        cases.append(
            {
                "case": "Movies Compound Filter (Drama, year>=2000, sort avg_rating)",
                "collection": "movies",
                "docs_in_collection": await db.movies.count_documents({}),
                "indexed": ix1,
                "collscan": cs1,
                "speedup_x": round(cs1["avgClientMs"] / max(ix1["avgClientMs"], 0.001), 2),
            }
        )

        # Case 2: Users Unique Email Lookup (tail user so COLLSCAN scans entire collection)
        q2 = {"email": "cinephile.214@titofilm.local"}
        ix2 = await run_explain_and_time(db, "users", q2, hint="uq_users_email", limit=1)
        cs2 = await run_explain_and_time(db, "users", q2, hint={"$natural": 1}, limit=1)
        cases.append(
            {
                "case": "Users Unique Email Lookup (Login)",
                "collection": "users",
                "docs_in_collection": await db.users.count_documents({}),
                "indexed": ix2,
                "collscan": cs2,
                "speedup_x": round(cs2["avgClientMs"] / max(ix2["avgClientMs"], 0.001), 2),
            }
        )

        # Case 3: Movies Text Index Search vs Unindexed Regex Scan
        q3_text = {"is_deleted": False, "$text": {"$search": "Nolan Batman Inception"}}
        q3_regex = {
            "is_deleted": False,
            "$or": [
                {"title": {"$regex": "Nolan|Batman|Inception", "$options": "i"}},
                {"overview": {"$regex": "Nolan|Batman|Inception", "$options": "i"}},
                {"directors": {"$regex": "Nolan|Batman|Inception", "$options": "i"}},
            ],
        }
        ix3 = await run_explain_and_time(db, "movies", q3_text, limit=20)
        cs3 = await run_explain_and_time(db, "movies", q3_regex, hint={"$natural": 1}, limit=20)
        cases.append(
            {
                "case": "Movies Full-Text Search ($text index vs $regex COLLSCAN)",
                "collection": "movies",
                "docs_in_collection": await db.movies.count_documents({}),
                "indexed": ix3,
                "collscan": cs3,
                "speedup_x": round(cs3["avgClientMs"] / max(ix3["avgClientMs"], 0.001), 2),
            }
        )

        # Case 4: Reviews Compound Index on seeded 6,000+ reviews
        q4 = {"movie_id": sample_movie["_id"], "is_hidden": False}
        s4 = [("created_at", DESCENDING)]
        ix4 = await run_explain_and_time(db, "reviews", q4, sort=s4, hint="idx_reviews_movie_visible_created", limit=20)
        cs4 = await run_explain_and_time(db, "reviews", q4, sort=s4, hint={"$natural": 1}, limit=20)
        cases.append(
            {
                "case": "Reviews by Movie + Sort Newest (Seeded 6,000+ docs)",
                "collection": "reviews",
                "docs_in_collection": await db.reviews.count_documents({}),
                "indexed": ix4,
                "collscan": cs4,
                "speedup_x": round(cs4["avgClientMs"] / max(ix4["avgClientMs"], 0.001), 2),
            }
        )

        # Case 5: Scaled 50,000 Reviews Stress Benchmark
        cases.append(await benchmark_scaled_reviews_50k(db))

        # Print summary table
        print("\n=== MongoDB Benchmark: Index (IXSCAN/TEXT) vs COLLSCAN ===\n")
        for c in cases:
            ix = c["indexed"]
            cs = c["collscan"]
            print(f"[{c['case']}] ({c['docs_in_collection']:,} docs)")
            print(
                f"  INDEXED : stage={ix['stage']:<10} docsExamined={ix['totalDocsExamined']:<6} "
                f"keysExamined={ix['totalKeysExamined']:<6} avg={ix['avgClientMs']:.3f}ms p95={ix['p95ClientMs']:.3f}ms"
            )
            print(
                f"  COLLSCAN: stage={cs['stage']:<10} docsExamined={cs['totalDocsExamined']:<6} "
                f"keysExamined={cs['totalKeysExamined']:<6} avg={cs['avgClientMs']:.3f}ms p95={cs['p95ClientMs']:.3f}ms"
            )
            print(f"  SPEEDUP : {c['speedup_x']}x faster\n")

        # Save markdown & JSON benchmark artifacts
        docs_dir = ROOT_DIR / "docs"
        docs_dir.mkdir(parents=True, exist_ok=True)
        (docs_dir / "benchmark_mongodb.json").write_text(json.dumps(cases, indent=2), encoding="utf-8")

        md_lines = [
            "# MongoDB Performance Benchmark — Index (IXSCAN / TEXT) vs COLLSCAN",
            "",
            f"Generated at: `{datetime.now(timezone.utc).isoformat()}`",
            "",
            "| Benchmark Case | Collection Size | Indexed Stage | Indexed Docs Examined | COLLSCAN Docs Examined | Indexed Avg (ms) | COLLSCAN Avg (ms) | Speedup |",
            "|---|---:|---|---:|---:|---:|---:|---:|",
        ]
        for c in cases:
            ix, cs = c["indexed"], c["collscan"]
            md_lines.append(
                f"| {c['case']} | {c['docs_in_collection']:,} | `{ix['stage']}` | "
                f"{ix['totalDocsExamined']:,} | {cs['totalDocsExamined']:,} | "
                f"{ix['avgClientMs']:.3f} | {cs['avgClientMs']:.3f} | **{c['speedup_x']}x** |"
            )
        (docs_dir / "benchmark_mongodb.md").write_text("\n".join(md_lines) + "\n", encoding="utf-8")
        print(f"Saved reports to {docs_dir / 'benchmark_mongodb.md'} and benchmark_mongodb.json")
    finally:
        await mongo_manager.close()


if __name__ == "__main__":
    asyncio.run(main())
