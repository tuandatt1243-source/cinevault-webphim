from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictStr, field_validator

from app.models.common import PaginationMeta


class UserUpdateProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: StrictStr | None = Field(default=None, min_length=2, max_length=120)
    avatar_url: StrictStr | None = Field(default=None, max_length=500)
    bio: StrictStr | None = Field(default=None, max_length=500)
    favorite_genres: list[StrictStr] | None = Field(default=None, max_length=10)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return cleaned


class AdminUserUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "admin"] | None = None
    is_active: StrictBool | None = None
    full_name: StrictStr | None = Field(default=None, min_length=2, max_length=120)


class AdminUserItem(BaseModel):
    id: str
    email: str
    full_name: str
    role: Literal["user", "admin"]
    is_active: bool
    avatar_url: str | None = None
    favorite_genres: list[str] = Field(default_factory=list)
    watchlist_count: int = 0
    review_count: int = 0
    created_at: datetime
    updated_at: datetime


class PaginatedUsersResponse(BaseModel):
    items: list[AdminUserItem]
    meta: PaginationMeta
