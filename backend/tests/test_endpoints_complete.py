from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_profile_update_interactions_logout_and_sync_jobs_endpoint(client, admin_account, user_account):
    admin_headers = {"Authorization": f"Bearer {admin_account['token']}"}
    user_headers = {"Authorization": f"Bearer {user_account['token']}"}

    # 1. PATCH /users/me updates profile & favorite genres
    r_prof = await client.patch(
        "/api/v1/users/me",
        json={
            "full_name": "Viewer Updated",
            "bio": "Yêu thích điện ảnh kinh điển.",
            "favorite_genres": ["Drama", "Crime", "Sci-Fi"],
        },
        headers=user_headers,
    )
    assert r_prof.status_code == 200
    assert r_prof.json()["full_name"] == "Viewer Updated"
    assert r_prof.json()["favorite_genres"] == ["Drama", "Crime", "Sci-Fi"]

    # 2. Admin creates movie
    r_m = await client.post(
        "/api/v1/movies",
        json={
            "title": "Whiplash",
            "overview": "A promising young drummer enrolls at a cut-throat music conservatory.",
            "release_year": 2014,
            "runtime_minutes": 106,
            "genres": ["Drama", "Music"],
            "cast": ["Miles Teller", "J.K. Simmons"],
            "directors": ["Damien Chazelle"],
        },
        headers=admin_headers,
    )
    assert r_m.status_code == 201
    movie_id = r_m.json()["id"]

    # 3. POST /interactions records WATCH & LIKE and increments views_count on WATCH
    r_watch = await client.post(
        "/api/v1/interactions",
        json={"movie_id": movie_id, "type": "WATCH", "duration_sec": 120},
        headers=user_headers,
    )
    assert r_watch.status_code == 201
    assert r_watch.json()["type"] == "WATCH"

    r_like = await client.post(
        "/api/v1/interactions",
        json={"movie_id": movie_id, "type": "LIKE", "duration_sec": 0},
        headers=user_headers,
    )
    assert r_like.status_code == 201

    detail = (await client.get(f"/api/v1/movies/{movie_id}?track_view=false")).json()
    assert detail["views_count"] == 1

    # 4. Soft-deleted movie hides public reviews with 404, while Admin can still inspect
    await client.post(
        f"/api/v1/movies/{movie_id}/reviews",
        json={"rating": 5, "comment": "Nhịp dựng phim cực kỳ căng thẳng."},
        headers=user_headers,
    )
    await client.delete(f"/api/v1/movies/{movie_id}", headers=admin_headers)
    assert (await client.get(f"/api/v1/movies/{movie_id}/reviews")).status_code == 404
    assert (await client.get(f"/api/v1/movies/{movie_id}/reviews", headers=admin_headers)).status_code == 200

    # 5. GET /admin/sync-jobs returns sync queue & 5-collection index inventory (Admin only)
    assert (await client.get("/api/v1/admin/sync-jobs", headers=user_headers)).status_code == 403
    r_sj = await client.get("/api/v1/admin/sync-jobs", headers=admin_headers)
    assert r_sj.status_code == 200
    body = r_sj.json()
    assert len(body["indexes"]) == 5
    assert len(body["jobs"]) >= 4

    # 6. POST /auth/logout succeeds cleanly
    r_out = await client.post("/api/v1/auth/logout", headers=user_headers)
    assert r_out.status_code == 200
