from __future__ import annotations

import re
import unicodedata
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status


MAX_QUERY_LEN = 120


def parse_object_id(raw_id: str, field_name: str = "id") -> ObjectId:
    """Safely parse a 24-hex ObjectId string, preventing injection or malformed IDs."""
    if not isinstance(raw_id, str) or not ObjectId.is_valid(raw_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field_name} format: expected 24-character hex ObjectId.",
        )
    return ObjectId(raw_id)


def sanitize_search_text(query: str | None) -> str | None:
    """Strip unsafe MongoDB operator characters and cap length against ReDoS."""
    if query is None:
        return None
    cleaned = query.strip()
    if not cleaned:
        return None
    if len(cleaned) > MAX_QUERY_LEN:
        cleaned = cleaned[:MAX_QUERY_LEN]
    # Reject raw Mongo operator syntax or null bytes
    if "\x00" in cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid characters in search query.",
        )
    return cleaned


def safe_regex_pattern(query: str) -> str:
    """Escape regex metacharacters to block regex injection and catastrophic backtracking."""
    return re.escape(query[:MAX_QUERY_LEN])


def assert_no_mongo_operators(payload: Any) -> None:
    """Recursively reject keys starting with '$' or containing null bytes."""
    if isinstance(payload, dict):
        for k, v in payload.items():
            if not isinstance(k, str) or k.startswith("$") or "\x00" in k:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Potentially unsafe query operator detected in request payload.",
                )
            assert_no_mongo_operators(v)
    elif isinstance(payload, list):
        for item in payload:
            assert_no_mongo_operators(item)


def slugify(text: str, year: int | None = None) -> str:
    """Generate a URL-safe deterministic slug from title (+ optional year)."""
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized.lower()).strip("-")
    slug = slug or "untitled-film"
    if year is not None:
        slug = f"{slug}-{year}"
    return slug[:120]


def serialize_id(value: Any) -> str:
    return str(value)
