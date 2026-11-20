from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr, field_validator

from app.models.common import PaginationMeta


def _clean_str_list(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in values:
        item = raw.strip()
        if not item:
            continue
        if "$" in item or "\x00" in item:
            raise ValueError("Invalid characters detected.")
        key = item.lower()
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out


class MovieCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: StrictStr = Field(min_length=1, max_length=250)
    original_title: StrictStr | None = Field(default=None, max_length=250)
    slug: StrictStr | None = Field(default=None, max_length=160)
    overview: StrictStr = Field(default="", max_length=4000)
    release_year: StrictInt = Field(ge=1888, le=2100)
    runtime_minutes: StrictInt = Field(ge=1, le=1000)
    certificate: StrictStr | None = Field(default=None, max_length=32)
    poster_url: StrictStr | None = Field(default=None, max_length=1000)
    backdrop_url: StrictStr | None = Field(default=None, max_length=1000)
    trailer_url: StrictStr | None = Field(default=None, max_length=1000)
    genres: list[StrictStr] = Field(min_length=1, max_length=10)
    cast: list[StrictStr] = Field(default_factory=list, max_length=30)
    directors: list[StrictStr] = Field(default_factory=list, max_length=10)
    language: StrictStr | None = Field(default="English", max_length=64)
    country: StrictStr | None = Field(default="USA", max_length=64)
    imdb_rating: float | None = Field(default=None, ge=0.0, le=10.0)
    meta_score: StrictInt | None = Field(default=None, ge=0, le=100)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Movie title cannot be empty.")
        return cleaned

    @field_validator("genres")
    @classmethod
    def clean_genres(cls, values: list[str]) -> list[str]:
        cleaned = _clean_str_list(values)
        if not cleaned:
            raise ValueError("At least one genre is required.")
        return cleaned

    @field_validator("cast", "directors")
    @classmethod
    def clean_people(cls, values: list[str]) -> list[str]:
        return _clean_str_list(values)


class MovieUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: StrictStr | None = Field(default=None, min_length=1, max_length=250)
    original_title: StrictStr | None = Field(default=None, max_length=250)
    overview: StrictStr | None = Field(default=None, max_length=4000)
    release_year: StrictInt | None = Field(default=None, ge=1888, le=2100)
    runtime_minutes: StrictInt | None = Field(default=None, ge=1, le=1000)
    certificate: StrictStr | None = Field(default=None, max_length=32)
    poster_url: StrictStr | None = Field(default=None, max_length=1000)
    backdrop_url: StrictStr | None = Field(default=None, max_length=1000)
    trailer_url: StrictStr | None = Field(default=None, max_length=1000)
    genres: list[StrictStr] | None = Field(default=None, min_length=1, max_length=10)
    cast: list[StrictStr] | None = Field(default=None, max_length=30)
    directors: list[StrictStr] | None = Field(default=None, max_length=10)
    language: StrictStr | None = Field(default=None, max_length=64)
    country: StrictStr | None = Field(default=None, max_length=64)
    imdb_rating: float | None = Field(default=None, ge=0.0, le=10.0)
    meta_score: StrictInt | None = Field(default=None, ge=0, le=100)

    @field_validator("genres")
    @classmethod
    def clean_genres(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        cleaned = _clean_str_list(values)
        if not cleaned:
            raise ValueError("At least one genre is required.")
        return cleaned

    @field_validator("cast", "directors")
    @classmethod
    def clean_people(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        return _clean_str_list(values)


class MovieOut(BaseModel):
    id: str
    slug: str
    title: str
    original_title: str | None = None
    overview: str
    overview_i18n: dict[str, str] = Field(default_factory=dict)
    release_year: int
    runtime_minutes: int
    certificate: str | None = None
    poster_url: str | None = None
    backdrop_url: str | None = None
    trailer_url: str | None = None
    genres: list[str]
    cast: list[str]
    directors: list[str]
    language: str | None = None
    country: str | None = None
    imdb_rating: float | None = None
    meta_score: int | None = None
    avg_rating: float
    rating_count: int
    views_count: int
    is_deleted: bool
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PaginatedMoviesResponse(BaseModel):
    items: list[MovieOut]
    meta: PaginationMeta


class GenreFacet(BaseModel):
    name: str
    count: int
