from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse
from pathlib import Path

import httpx
from fastapi import HTTPException, status
from pymongo.asynchronous.database import AsyncDatabase

from app.core.sanitize import parse_object_id

logger = logging.getLogger("cinevault.posters")

POSTERS_DIR = Path(__file__).resolve().parents[2] / "data" / "posters"
POSTERS_DIR.mkdir(parents=True, exist_ok=True)

_DOWNLOAD_LOCKS: dict[str, asyncio.Lock] = {}
_BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/jpeg,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def get_cached_poster_path(movie_id: str) -> Path:
    return POSTERS_DIR / f"{movie_id}.jpg"


def normalize_poster_url(url: str) -> str:
    cleaned = (url or "").strip()
    if not cleaned:
        return ""
    # Upgrade legacy http://ia.media-imdb.com to modern HTTPS m.media-amazon.com
    cleaned = cleaned.replace("http://ia.media-imdb.com/", "https://m.media-amazon.com/")
    cleaned = cleaned.replace("https://ia.media-imdb.com/", "https://m.media-amazon.com/")
    cleaned = cleaned.replace("https://images-na.ssl-images-amazon.com/", "https://m.media-amazon.com/")
    if "m.media-amazon.com" in cleaned and "._V1_" in cleaned:
        cleaned = re.sub(r"\._V1_.*\.jpg$", "._V1_QL80_UX420_.jpg", cleaned)
    return cleaned


async def lookup_fresh_imdb_poster(title: str, release_year: int | None = None) -> str | None:
    """Resolve a live 2026 IMDb poster URL via IMDb's public v3 suggestion API when an old link 404s."""
    query = re.sub(r"[^a-zA-Z0-9\s]", " ", title or "").strip().lower()
    if not query:
        return None
    encoded = urllib.parse.quote(query[:60])
    url = f"https://v3.sg.media-imdb.com/suggestion/x/{encoded}.json"
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=6.0),
            headers={"User-Agent": _BROWSER_HEADERS["User-Agent"]},
        ) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            items = resp.json().get("d", [])
            # Prefer exact release year match with imageUrl
            if release_year:
                for it in items:
                    img_url = (it.get("i") or {}).get("imageUrl")
                    if img_url and it.get("y") == release_year:
                        return normalize_poster_url(img_url)
                for it in items:
                    img_url = (it.get("i") or {}).get("imageUrl")
                    if img_url and isinstance(it.get("y"), int) and abs(it["y"] - release_year) <= 1:
                        return normalize_poster_url(img_url)
            for it in items:
                img_url = (it.get("i") or {}).get("imageUrl")
                if img_url:
                    return normalize_poster_url(img_url)
    except Exception as exc:
        logger.debug("IMDb v3 lookup failed for %s (%s): %s", title, release_year, exc)
    return None


async def fetch_image_bytes(url: str, retries: int = 4) -> tuple[bytes, str] | None:
    """Resilient image downloader that retries abrupt CDN TCP resets."""
    primary = normalize_poster_url(url)
    if not primary:
        return None
    candidates = [primary]
    if "m.media-amazon.com" in primary and "._V1_" in primary:
        alt = re.sub(r"\._V1_.*\.jpg$", "._V1_SX400_.jpg", primary)
        if alt != primary:
            candidates.append(alt)

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=httpx.Timeout(10.0, connect=6.0),
        headers=_BROWSER_HEADERS,
    ) as client:
        for attempt in range(retries):
            target = candidates[attempt % len(candidates)]
            try:
                resp = await client.get(target)
                ct = resp.headers.get("content-type", "")
                if resp.status_code == 200 and ct.startswith("image/") and len(resp.content) > 500:
                    return resp.content, ct
                # Permanent 404/403 — stop retrying the dead URL immediately
                if resp.status_code in (403, 404, 410):
                    return None
            except Exception as exc:
                logger.debug("Poster fetch attempt %d failed for %s: %s", attempt + 1, target, exc)
            await asyncio.sleep(0.25 * (attempt + 1))
    return None


async def get_or_cache_movie_poster(db: AsyncDatabase, movie_id_str: str) -> tuple[Path, str]:
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    cache_path = get_cached_poster_path(movie_id_str)
    if cache_path.exists() and cache_path.stat().st_size > 500:
        return cache_path, "image/jpeg"

    doc = await db.movies.find_one({"_id": movie_oid}, {"title": 1, "release_year": 1, "poster_url": 1})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")

    lock = _DOWNLOAD_LOCKS.setdefault(movie_id_str, asyncio.Lock())
    async with lock:
        if cache_path.exists() and cache_path.stat().st_size > 500:
            return cache_path, "image/jpeg"

        result = await fetch_image_bytes(doc.get("poster_url") or "")
        if result is None and doc.get("title"):
            fresh_url = await lookup_fresh_imdb_poster(doc["title"], doc.get("release_year"))
            if fresh_url:
                result = await fetch_image_bytes(fresh_url, retries=3)
                if result is not None:
                    await db.movies.update_one(
                        {"_id": movie_oid},
                        {"$set": {"poster_url": fresh_url, "backdrop_url": fresh_url}},
                    )

        if result is None:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Upstream poster unreachable.")

        data, content_type = result
        POSTERS_DIR.mkdir(parents=True, exist_ok=True)
        tmp_path = cache_path.with_suffix(".tmp")
        tmp_path.write_bytes(data)
        tmp_path.replace(cache_path)
        return cache_path, content_type
