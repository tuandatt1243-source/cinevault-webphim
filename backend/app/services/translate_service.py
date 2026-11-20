from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import HTTPException, status
from pymongo.asynchronous.database import AsyncDatabase

from app.core.hooks import get_cache_provider
from app.core.sanitize import parse_object_id

logger = logging.getLogger("cinevault.translate")

SUPPORTED_LANG_MAP: dict[str, str] = {
    "vi": "vi",
    "en": "en",
    "ja": "ja",
    "ko": "ko",
    "fr": "fr",
    "zh": "zh-CN",
}


async def translate_text_free(text: str, target_lang: str) -> str | None:
    """Translate text via Google Translate public endpoint (no API key needed) with graceful fallback."""
    cleaned = (text or "").strip()
    if not cleaned:
        return ""
    tl = SUPPORTED_LANG_MAP.get(target_lang)
    if not tl or tl == "en":
        return cleaned

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(8.0, connect=5.0),
            headers={"User-Agent": "Mozilla/5.0"},
        ) as client:
            resp = await client.get(
                "https://translate.googleapis.com/translate_a/single",
                params={"client": "gtx", "sl": "auto", "tl": tl, "dt": "t", "q": cleaned},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            if not isinstance(data, list) or not data or not isinstance(data[0], list):
                return None
            translated = "".join(seg[0] for seg in data[0] if isinstance(seg, list) and seg and seg[0])
            return translated.strip() or None
    except Exception as exc:
        logger.warning("Translation to '%s' failed (graceful fallback): %s", target_lang, exc)
        return None


async def get_or_translate_movie_overview(
    db: AsyncDatabase,
    movie_id_str: str,
    lang: str,
) -> dict[str, Any]:
    if lang not in SUPPORTED_LANG_MAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported language '{lang}'. Supported: {', '.join(SUPPORTED_LANG_MAP.keys())}.",
        )

    movie_oid = parse_object_id(movie_id_str, "movie_id")
    doc = await db.movies.find_one(
        {"_id": movie_oid},
        {"overview": 1, "overview_i18n": 1},
    )
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found.")

    original = doc.get("overview", "")
    if lang == "en" or not original:
        return {"movie_id": movie_id_str, "lang": lang, "overview": original, "cached": True}

    i18n_map = doc.get("overview_i18n") or {}
    if isinstance(i18n_map, dict) and i18n_map.get(lang):
        return {
            "movie_id": movie_id_str,
            "lang": lang,
            "overview": i18n_map[lang],
            "cached": True,
        }

    translated = await translate_text_free(original, lang)
    if not translated:
        return {"movie_id": movie_id_str, "lang": lang, "overview": original, "cached": False}

    await db.movies.update_one(
        {"_id": movie_oid},
        {"$set": {f"overview_i18n.{lang}": translated}},
    )
    try:
        await get_cache_provider().invalidate_movie(movie_id_str)
    except Exception:
        pass

    return {
        "movie_id": movie_id_str,
        "lang": lang,
        "overview": translated,
        "cached": False,
    }
