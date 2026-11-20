from __future__ import annotations

import pytest

from scripts.seed_mongo import deterministic_oid, load_real_movies


def test_real_movie_dataset_loads_600_plus_movies():
    movies = load_real_movies(600)
    assert len(movies) == 600
    slugs = {m["slug"] for m in movies}
    assert len(slugs) == 600
    # Verify high-res poster URL upgrade and real metadata
    first = movies[0]
    assert first["title"] == "The Shawshank Redemption"
    assert first["release_year"] == 1994
    assert "Drama" in first["genres"]
    assert "Frank Darabont" in first["directors"]
    assert "UX420" in (first["poster_url"] or "")


def test_deterministic_object_ids_are_repeatable():
    oid1 = deterministic_oid("movie", "the-shawshank-redemption-1994")
    oid2 = deterministic_oid("movie", "the-shawshank-redemption-1994")
    oid3 = deterministic_oid("movie", "the-godfather-1972")
    assert oid1 == oid2
    assert oid1 != oid3
    assert len(str(oid1)) == 24


@pytest.mark.asyncio
async def test_admin_stats_aggregation_endpoint(client, admin_account):
    admin_headers = {"Authorization": f"Bearer {admin_account['token']}"}
    r_m = await client.post(
        "/api/v1/movies",
        json={
            "title": "Oppenheimer",
            "overview": "The story of American scientist J. Robert Oppenheimer.",
            "release_year": 2023,
            "runtime_minutes": 180,
            "genres": ["Biography", "Drama", "History"],
            "cast": ["Cillian Murphy", "Emily Blunt"],
            "directors": ["Christopher Nolan"],
        },
        headers=admin_headers,
    )
    assert r_m.status_code == 201
    movie_id = r_m.json()["id"]

    await client.post(
        f"/api/v1/movies/{movie_id}/reviews",
        json={"rating": 5, "comment": "Âm thanh và dựng phim cực kỳ ám ảnh."},
        headers=admin_headers,
    )

    r_stats = await client.get("/api/v1/admin/stats", headers=admin_headers)
    assert r_stats.status_code == 200
    stats = r_stats.json()
    assert stats["kpis"]["total_movies"] == 1
    assert stats["kpis"]["total_reviews"] == 1
    assert stats["kpis"]["global_avg_rating"] == 5.0
    assert len(stats["rating_distribution"]) == 5
    assert any(g["genre"] == "Biography" for g in stats["top_genres"])
    assert any(d["decade"] == "2020s" for d in stats["movies_by_decade"])
