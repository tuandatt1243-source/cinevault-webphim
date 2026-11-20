from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, StrictStr, field_validator

from app.models.common import PaginationMeta


class ReviewUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: StrictInt = Field(ge=1, le=5, description="Strict integer rating between 1 and 5.")
    comment: StrictStr = Field(default="", max_length=2000)
    is_spoiler: StrictBool = False

    @field_validator("comment")
    @classmethod
    def clean_comment(cls, value: str) -> str:
        if "\x00" in value:
            raise ValueError("Invalid characters in comment.")
        return value.strip()


class ReviewModerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_hidden: StrictBool


class ReviewOut(BaseModel):
    id: str
    user_id: str
    user_name: str | None = None
    user_email: str | None = None
    movie_id: str
    movie_title: str | None = None
    movie_poster_url: str | None = None
    rating: int
    comment: str
    is_spoiler: bool = False
    is_hidden: bool
    created_at: datetime
    updated_at: datetime


class PaginatedReviewsResponse(BaseModel):
    items: list[ReviewOut]
    meta: PaginationMeta
