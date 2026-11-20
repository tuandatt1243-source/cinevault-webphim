from __future__ import annotations

import asyncio
import logging
import re
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


async def fetch_image_bytes(url: str, retries: int = 4) -> tuple[bytes, str] | None:
    """Resilient image downloader that retries abrupt CDN TCP resets (common with Amazon IMDb CDN)."""
    candidates = [url]
    # Fallback to alternate IMDb resize pattern if primary variant resets
    if "m.media-amazon.com" in url and "._V1_" in url:
        alt = re.sub(r"\._V1_.*\.jpg$", "._V1_SX400_.jpg", url)
        if alt != url:
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
            except Exception as exc:
                logger.debug("Poster fetch attempt %d failed for %s: %s", attempt + 1, target, exc)
            await asyncio.sleep(0.25 * (attempt + 1))
    return None


async def get_or_cache_movie_poster(db: AsyncDatabase, movie_id_str: str) -> tuple[Path, str]:
    movie_oid = parse_object_id(movie_id_str, "movie_id")
    cache_path = get_cached_poster_path(movie_id_str)
    if cache_path.exists() and cache_path.stat().st_size > 500:
        return cache_path, "image/jpeg"

    doc = await db.movies.find_one({"_id": movie_oid}, {"poster_url": 1})
    if doc is None or not doc.get("poster_url"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poster not available.")

    lock = _DOWNLOAD_LOCKS.setdefault(movie_id_str, asyncio.Lock())
    async with lock:
        if cache_path.exists() and cache_path.stat().st_size > 500:
            return cache_path, "image/jpeg"

        result = await fetch_image_bytes(doc["poster_url"])
        if result is None:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Upstream poster unreachable.")

        data, content_type = result
        POSTERS_DIR.mkdir(parents=True, exist_ok=True)
        tmp_path = cache_path.with_suffix(".tmp")
        tmp_path.write_bytes(data)
        tmp_path.replace(cache_path)
        return cache_path, content_type
