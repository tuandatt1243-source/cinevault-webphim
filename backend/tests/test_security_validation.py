from __future__ import annotations

from datetime import datetime, timezone

import pytest
from bson import ObjectId
from pymongo.errors import WriteError


@pytest.mark.asyncio
async def test_invalid_ratings_rejected(client, admin_account, user_account):
    admin_headers = {"Authorization": f"Bearer {admin_account['token']}"}
    user_headers = {"Authorization": f"Bearer {user_account['token']}"}

    r_movie = await client.post(
        "/api/v1/movies",
        json={
            "title": "Parasite",
            "overview": "Greed and class discrimination threaten a symbiotic relationship.",
            "release_year": 2019,
            "runtime_minutes": 132,
            "genres": ["Drama", "Thriller"],
            "cast": ["Song Kang-ho"],
            "directors": ["Bong Joon Ho"],
        },
        headers=admin_headers,
    )
    movie_id = r_movie.json()["id"]

    invalid_ratings = [0, -2, 6, 4.5, "5", None, {"$gt": 0}]
    for bad in invalid_ratings:
        res = await client.post(
            f"/api/v1/movies/{movie_id}/reviews",
            json={"rating": bad, "comment": "Testing validation"},
            headers=user_headers,
        )
        assert res.status_code in (400, 422), f"Expected rejection for rating={bad}, got {res.status_code}"


@pytest.mark.asyncio
async def test_nosql_injection_blocked(client, admin_account):
    # 1. Operator injection in login JSON body
    r1 = await client.post(
        "/api/v1/auth/login",
        json={"email": {"$ne": None}, "password": {"$ne": None}},
    )
    assert r1.status_code == 400

    # 2. Nested operator injection in movie create
    r2 = await client.post(
        "/api/v1/movies",
        json={
            "title": "Legit",
            "release_year": 2020,
            "runtime_minutes": 100,
            "genres": ["Drama"],
            "$where": "this.is_deleted == false",
        },
        headers={"Authorization": f"Bearer {admin_account['token']}"},
    )
    assert r2.status_code == 400

    # 3. Query string operator injection
    r3 = await client.get("/api/v1/movies?$where=sleep(5000)")
    assert r3.status_code == 400

    # 4. Regex ReDoS payload safely escaped and returns 200 without hanging
    r4 = await client.get("/api/v1/movies", params={"q": "((((a+)+)+)+)$"})
    assert r4.status_code == 200

    # 5. Malformed ObjectId rejected with 400
    r5 = await client.get("/api/v1/movies/not-a-valid-objectid")
    assert r5.status_code == 400


@pytest.mark.asyncio
async def test_mongodb_json_schema_server_side_validation(test_db):
    """Prove MongoDB $jsonSchema enforces data integrity even on raw DB inserts."""
    now = datetime.now(timezone.utc)

    # Invalid rating = 9 directly into reviews collection must raise WriteError (code 121)
    with pytest.raises(WriteError) as exc_rev:
        await test_db.reviews.insert_one(
            {
                "user_id": ObjectId(),
                "movie_id": ObjectId(),
                "rating": 9,
                "comment": "Bypassing API directly",
                "is_hidden": False,
                "created_at": now,
                "updated_at": now,
            }
        )
    assert exc_rev.value.code == 121

    # Invalid role = 'superhacker' directly into users collection must raise WriteError (code 121)
    with pytest.raises(WriteError) as exc_usr:
        await test_db.users.insert_one(
            {
                "email": "hacker@example.com",
                "password_hash": "x" * 60,
                "full_name": "Bad Role",
                "role": "superhacker",
                "is_active": True,
                "favorite_genres": [],
                "watchlist": [],
                "created_at": now,
                "updated_at": now,
            }
        )
    assert exc_usr.value.code == 121
