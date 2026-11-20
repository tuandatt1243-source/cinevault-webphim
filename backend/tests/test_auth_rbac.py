from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_register_login_and_duplicate_email_rejected(client):
    payload = {
        "email": "new.cinephile@cinevault.local",
        "password": "StrongPassword@123",
        "full_name": "Nguyễn Minh Khoa",
        "favorite_genres": ["Drama", "Sci-Fi"],
    }
    r1 = await client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201
    body = r1.json()
    assert body["user"]["email"] == payload["email"]
    assert body["user"]["role"] == "user"
    assert len(body["user"]["id"]) == 24
    assert body["access_token"]

    # Duplicate email must fail with 409 Conflict
    r_dup = await client.post("/api/v1/auth/register", json=payload)
    assert r_dup.status_code == 409

    # Login succeeds with valid credentials
    r_login = await client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert r_login.status_code == 200
    token = r_login.json()["access_token"]

    # Wrong password rejected with 401
    r_bad = await client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": "WrongPassword!"},
    )
    assert r_bad.status_code == 401

    # /auth/me works with Bearer token
    r_me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r_me.status_code == 200
    assert r_me.json()["email"] == payload["email"]


@pytest.mark.asyncio
async def test_rbac_admin_vs_user_vs_anonymous(client, admin_account, user_account):
    movie_payload = {
        "title": "Dune: Part Two",
        "overview": "Paul Atreides unites with Chani and the Fremen.",
        "release_year": 2024,
        "runtime_minutes": 166,
        "genres": ["Sci-Fi", "Adventure"],
        "cast": ["Timothée Chalamet", "Zendaya"],
        "directors": ["Denis Villeneuve"],
    }

    # Anonymous cannot create movie or view admin endpoints -> 401
    assert (await client.post("/api/v1/movies", json=movie_payload)).status_code == 401
    assert (await client.get("/api/v1/admin/stats")).status_code == 401
    assert (await client.get("/api/v1/admin/users")).status_code == 401

    # Regular user cannot create movie or view admin endpoints -> 403
    user_headers = {"Authorization": f"Bearer {user_account['token']}"}
    assert (await client.post("/api/v1/movies", json=movie_payload, headers=user_headers)).status_code == 403
    assert (await client.get("/api/v1/admin/stats", headers=user_headers)).status_code == 403
    assert (await client.get("/api/v1/admin/users", headers=user_headers)).status_code == 403
    assert (await client.get("/api/v1/admin/reviews", headers=user_headers)).status_code == 403

    # Admin succeeds -> 201 / 200
    admin_headers = {"Authorization": f"Bearer {admin_account['token']}"}
    r_create = await client.post("/api/v1/movies", json=movie_payload, headers=admin_headers)
    assert r_create.status_code == 201
    assert (await client.get("/api/v1/admin/stats", headers=admin_headers)).status_code == 200
    assert (await client.get("/api/v1/admin/users", headers=admin_headers)).status_code == 200


@pytest.mark.asyncio
async def test_admin_suspend_user_and_prevent_self_lockout(client, admin_account, user_account):
    admin_headers = {"Authorization": f"Bearer {admin_account['token']}"}

    # Admin cannot suspend self -> 400
    r_self = await client.patch(
        f"/api/v1/admin/users/{admin_account['id']}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert r_self.status_code == 400

    # Admin suspends regular user
    r_lock = await client.patch(
        f"/api/v1/admin/users/{user_account['id']}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert r_lock.status_code == 200
    assert r_lock.json()["is_active"] is False

    # Suspended user cannot call protected endpoints or log in -> 403
    r_me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {user_account['token']}"},
    )
    assert r_me.status_code == 403
    r_login = await client.post(
        "/api/v1/auth/login",
        json={"email": user_account["email"], "password": "User@123"},
    )
    assert r_login.status_code == 403
