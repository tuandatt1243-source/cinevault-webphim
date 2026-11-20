from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_movie_crud_soft_delete_restore_and_sync_jobs(client, test_db, admin_account, user_account):
    admin_headers = {"Authorization": f"Bearer {admin_account['token']}"}
    user_headers = {"Authorization": f"Bearer {user_account['token']}"}

    # 1. Create movie
    r_create = await client.post(
        "/api/v1/movies",
        json={
            "title": "Past Lives",
            "overview": "Nora and Hae Sung, two deeply connected childhood friends, are wrested apart.",
            "release_year": 2023,
            "runtime_minutes": 106,
            "genres": ["Drama", "Romance"],
            "cast": ["Greta Lee", "Teo Yoo", "John Magaro"],
            "directors": ["Celine Song"],
        },
        headers=admin_headers,
    )
    assert r_create.status_code == 201
    movie = r_create.json()
    movie_id = movie["id"]
    assert movie["is_deleted"] is False

    # 2. Update movie
    r_upd = await client.put(
        f"/api/v1/movies/{movie_id}",
        json={"genres": ["Drama", "Romance", "Indie"], "runtime_minutes": 107},
        headers=admin_headers,
    )
    assert r_upd.status_code == 200
    assert r_upd.json()["runtime_minutes"] == 107

    # 3. Soft delete movie
    r_del = await client.delete(f"/api/v1/movies/{movie_id}", headers=admin_headers)
    assert r_del.status_code == 200
    assert r_del.json()["is_deleted"] is True
    assert r_del.json()["deleted_at"] is not None

    # Public detail returns 404 for soft-deleted film; public list hides it
    assert (await client.get(f"/api/v1/movies/{movie_id}")).status_code == 404
    r_pub_list = await client.get("/api/v1/movies")
    assert r_pub_list.json()["meta"]["total"] == 0

    # Regular user attempting status=deleted is forced back to active only
    r_user_trash = await client.get("/api/v1/movies?status=deleted", headers=user_headers)
    assert r_user_trash.json()["meta"]["total"] == 0

    # Admin sees soft-deleted film under status=deleted
    r_admin_trash = await client.get("/api/v1/movies?status=deleted", headers=admin_headers)
    assert r_admin_trash.json()["meta"]["total"] == 1

    # 4. Restore soft-deleted movie
    r_restore = await client.post(f"/api/v1/movies/{movie_id}/restore", headers=admin_headers)
    assert r_restore.status_code == 200
    assert r_restore.json()["is_deleted"] is False
    assert r_restore.json()["deleted_at"] is None

    # Public detail now succeeds again and increments view count
    r_pub_detail = await client.get(f"/api/v1/movies/{movie_id}")
    assert r_pub_detail.status_code == 200
    assert r_pub_detail.headers.get("X-Cache") == "BYPASS"

    # Verify sync_jobs recorded UPSERT -> UPSERT -> DELETE -> RESTORE
    jobs = (
        await test_db.sync_jobs.find({"entity_type": "movie", "entity_id": movie_id})
        .sort("created_at", 1)
        .to_list(length=20)
    )
    actions = [j["action"] for j in jobs]
    assert actions == ["UPSERT", "UPSERT", "DELETE", "RESTORE"]


@pytest.mark.asyncio
async def test_reviews_rating_aggregation_moderation_and_watchlist(client, admin_account, user_account):
    admin_headers = {"Authorization": f"Bearer {admin_account['token']}"}
    user_headers = {"Authorization": f"Bearer {user_account['token']}"}

    r_movie = await client.post(
        "/api/v1/movies",
        json={
            "title": "In the Mood for Love",
            "overview": "Two neighbors form a strong bond after suspecting extramarital activities.",
            "release_year": 2000,
            "runtime_minutes": 98,
            "genres": ["Drama", "Romance"],
            "cast": ["Tony Leung", "Maggie Cheung"],
            "directors": ["Wong Kar-wai"],
        },
        headers=admin_headers,
    )
    movie_id = r_movie.json()["id"]

    # Watchlist add / get / remove
    assert (await client.post(f"/api/v1/users/me/watchlist/{movie_id}", headers=user_headers)).status_code == 201
    wl = (await client.get("/api/v1/users/me/watchlist", headers=user_headers)).json()
    assert len(wl) == 1 and wl[0]["id"] == movie_id
    assert (await client.delete(f"/api/v1/users/me/watchlist/{movie_id}", headers=user_headers)).status_code == 200

    # User posts 5-star review; admin posts 3-star review -> avg_rating should be 4.0
    r_rev1 = await client.post(
        f"/api/v1/movies/{movie_id}/reviews",
        json={"rating": 5, "comment": "Kiệt tác màu sắc và cảm xúc."},
        headers=user_headers,
    )
    assert r_rev1.status_code == 201
    rev1_id = r_rev1.json()["id"]

    r_rev2 = await client.post(
        f"/api/v1/movies/{movie_id}/reviews",
        json={"rating": 3, "comment": "Nhịp phim chậm nhưng rất đẹp."},
        headers=admin_headers,
    )
    assert r_rev2.status_code == 201

    detail = (await client.get(f"/api/v1/movies/{movie_id}?track_view=false")).json()
    assert detail["avg_rating"] == 4.0
    assert detail["rating_count"] == 2

    # Admin hides rev2 (3 stars) -> avg_rating should recalculate to 5.0 (rating_count=1)
    r_mod = await client.patch(
        f"/api/v1/admin/reviews/{r_rev2.json()['id']}/moderate",
        json={"is_hidden": True},
        headers=admin_headers,
    )
    assert r_mod.status_code == 200
    detail2 = (await client.get(f"/api/v1/movies/{movie_id}?track_view=false")).json()
    assert detail2["avg_rating"] == 5.0
    assert detail2["rating_count"] == 1

    # Regular user cannot delete someone else's review -> 403
    assert (
        await client.delete(f"/api/v1/reviews/{r_rev2.json()['id']}", headers=user_headers)
    ).status_code == 403

    # Owner deletes own review -> avg_rating drops back to 0.0
    assert (await client.delete(f"/api/v1/reviews/{rev1_id}", headers=user_headers)).status_code == 200
    detail3 = (await client.get(f"/api/v1/movies/{movie_id}?track_view=false")).json()
    assert detail3["avg_rating"] == 0.0
    assert detail3["rating_count"] == 0
