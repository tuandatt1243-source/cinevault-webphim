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
    assert len(body["indexes"]) == 6
    assert len(body["jobs"]) >= 4

    # 6. POST /auth/logout succeeds cleanly
    r_out = await client.post("/api/v1/auth/logout", headers=user_headers)
    assert r_out.status_code == 200


@pytest.mark.asyncio
async def test_discovery_endpoints_decades_roulette_insights_person_and_spoiler(client, admin_account, user_account):
    admin_headers = {"Authorization": f"Bearer {admin_account['token']}"}
    user_headers = {"Authorization": f"Bearer {user_account['token']}"}

    # Create two movies by the same director in different decades
    r1 = await client.post(
        "/api/v1/movies",
        json={
            "title": "Inception Test",
            "overview": "A thief steals corporate secrets through dream-sharing technology.",
            "release_year": 2010,
            "runtime_minutes": 148,
            "trailer_url": "https://www.youtube.com/watch?v=YoHD9XEInc0",
            "genres": ["Action", "Sci-Fi"],
            "cast": ["Leonardo DiCaprio", "Joseph Gordon-Levitt"],
            "directors": ["Christopher Nolan"],
            "imdb_rating": 8.8,
            "meta_score": 74,
        },
        headers=admin_headers,
    )
    assert r1.status_code == 201
    m1_id = r1.json()["id"]

    r2 = await client.post(
        "/api/v1/movies",
        json={
            "title": "Memento Test",
            "overview": "A man with short-term memory loss attempts to track down his wife's killer.",
            "release_year": 2000,
            "runtime_minutes": 95,
            "trailer_url": "https://www.youtube.com/watch?v=4CV41hoyS8A",
            "genres": ["Mystery", "Thriller"],
            "cast": ["Guy Pearce"],
            "directors": ["Christopher Nolan"],
            "imdb_rating": 8.4,
            "meta_score": 83,
        },
        headers=admin_headers,
    )
    assert r2.status_code == 201

    # Post a spoiler-flagged review
    r_rev = await client.post(
        f"/api/v1/movies/{m1_id}/reviews",
        json={"rating": 5, "comment": "The spinning top ending leaves reality open!", "is_spoiler": True},
        headers=user_headers,
    )
    assert r_rev.status_code == 201
    assert r_rev.json()["is_spoiler"] is True

    # 1. GET /movies/{id}/insights returns 5-star histogram + other film by same director
    r_ins = await client.get(f"/api/v1/movies/{m1_id}/insights")
    assert r_ins.status_code == 200
    ins = r_ins.json()
    assert ins["total_reviews"] == 1
    assert len(ins["histogram"]) == 5
    assert ins["histogram"][0]["stars"] == 5 and ins["histogram"][0]["count"] == 1
    assert any(m["title"] == "Memento Test" for m in ins["more_from_director"])

    # 2. GET /movies/decades aggregates eras
    r_dec = await client.get("/api/v1/movies/decades")
    assert r_dec.status_code == 200
    dec_labels = {d["decade"] for d in r_dec.json()}
    assert {2000, 2010}.issubset(dec_labels)

    # 3. GET /movies/roulette returns sampled films matching mood & runtime
    r_roul = await client.get("/api/v1/movies/roulette?mood=quick&max_runtime=100&limit=5")
    assert r_roul.status_code == 200
    assert len(r_roul.json()) >= 1
    assert r_roul.json()[0]["runtime_minutes"] <= 100

    # 4. GET /movies/person returns director career metrics & filmography
    r_per = await client.get("/api/v1/movies/person?name=Christopher%20Nolan&role=director")
    assert r_per.status_code == 200
    per = r_per.json()
    assert per["movie_count"] == 2
    assert per["year_span"] == "2000–2010"

    # 5. Extended GET /movies filters (decade + max_runtime + director)
    r_flt = await client.get("/api/v1/movies?decade=2000&max_runtime=100&director=Christopher%20Nolan")
    assert r_flt.status_code == 200
    assert r_flt.json()["meta"]["total"] == 1
    assert r_flt.json()["items"][0]["title"] == "Memento Test"


@pytest.mark.asyncio
async def test_assistant_mongodb_rag_and_embedded_chat_sessions(client, admin_account, user_account):
    admin_headers = {"Authorization": f"Bearer {admin_account['token']}"}
    user_headers = {"Authorization": f"Bearer {user_account['token']}"}

    await client.post(
        "/api/v1/movies",
        json={
            "title": "Primer Test",
            "overview": "Two engineers accidentally invent time travel in a suburban garage.",
            "release_year": 2004,
            "runtime_minutes": 77,
            "genres": ["Sci-Fi", "Mystery", "Thriller"],
            "cast": ["Shane Carruth"],
            "directors": ["Shane Carruth"],
            "imdb_rating": 6.9,
        },
        headers=admin_headers,
    )
    await client.post(
        "/api/v1/movies",
        json={
            "title": "Spirited Away Test",
            "overview": "A young girl wanders into a world of spirits.",
            "release_year": 2001,
            "runtime_minutes": 125,
            "genres": ["Animation", "Family", "Fantasy"],
            "cast": ["Rumi Hiiragi"],
            "directors": ["Hayao Miyazaki"],
            "imdb_rating": 8.6,
        },
        headers=admin_headers,
    )
    await client.post(
        "/api/v1/movies",
        json={
            "title": "Dark Crime Test",
            "overview": "A gritty crime thriller.",
            "release_year": 2008,
            "runtime_minutes": 150,
            "genres": ["Crime", "Drama"],
            "cast": ["Actor A"],
            "directors": ["Director A"],
            "imdb_rating": 9.0,
        },
        headers=admin_headers,
    )

    # Regression: "animation" and Vietnamese "mà" must NOT match "ma" (Horror/Crime) via substring collision
    for msg, lang in (("but i want animation film", "en"), ("phim hoạt hình mà hay", "vi")):
        r_anim = await client.post(
            "/api/v1/assistant/chat",
            json={"message": msg, "lang": lang},
            headers=user_headers,
        )
        assert r_anim.status_code == 200
        anim_body = r_anim.json()
        assert anim_body["mongo_filter"].get("genres") == {"$in": ["Animation"]}
        assert len(anim_body["movies"]) >= 1
        assert all("Animation" in m["genres"] for m in anim_body["movies"])
        await client.delete(f"/api/v1/assistant/sessions/{anim_body['session_id']}")

    r_status = await client.get("/api/v1/assistant/status")
    assert r_status.status_code == 200
    assert r_status.json()["mode"] in ("mongodb-rag", "gemini-rag")

    # 1. Natural language Vietnamese query -> real MongoDB retrieval
    r_chat = await client.post(
        "/api/v1/assistant/chat",
        json={"message": "Gợi ý phim hack não dưới 100 phút", "lang": "vi"},
        headers=user_headers,
    )
    assert r_chat.status_code == 200
    chat_body = r_chat.json()
    sid = chat_body["session_id"]
    assert len(chat_body["movies"]) >= 1
    assert chat_body["movies"][0]["runtime_minutes"] <= 100
    assert chat_body["retrieval_ms"] >= 0

    # 2. Verify Embedded Document persistence in `chat_sessions`
    r_sess = await client.get(f"/api/v1/assistant/sessions/{sid}")
    assert r_sess.status_code == 200
    assert len(r_sess.json()["messages"]) == 2
    assert r_sess.json()["messages"][0]["role"] == "user"
    assert r_sess.json()["messages"][1]["role"] == "assistant"

    # 3. Clean delete session
    r_del = await client.delete(f"/api/v1/assistant/sessions/{sid}")
    assert r_del.status_code == 200
    assert (await client.get(f"/api/v1/assistant/sessions/{sid}")).json()["messages"] == []
