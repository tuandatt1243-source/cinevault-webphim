from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictStr, field_validator

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def _validate_email(value: str) -> str:
    cleaned = value.strip().lower()
    if len(cleaned) > 255 or not EMAIL_REGEX.match(cleaned):
        raise ValueError("Invalid email address format.")
    return cleaned


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: StrictStr = Field(min_length=5, max_length=255)
    password: StrictStr = Field(min_length=8, max_length=128)
    full_name: StrictStr = Field(min_length=2, max_length=120)
    favorite_genres: list[StrictStr] = Field(default_factory=list, max_length=10)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return _validate_email(value)

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        if "$" in cleaned or "\x00" in cleaned:
            raise ValueError("Invalid characters in full name.")
        return cleaned


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: StrictStr = Field(min_length=5, max_length=255)
    password: StrictStr = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return _validate_email(value)


class UserPublic(BaseModel):
    id: str
    email: str
    full_name: str
    role: Literal["user", "admin"]
    is_active: bool
    avatar_url: str | None = None
    bio: str | None = None
    favorite_genres: list[str] = Field(default_factory=list)
    watchlist: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserPublic
