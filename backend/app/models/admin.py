from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AdminOverviewKPIs(BaseModel):
    total_movies: int
    deleted_movies: int
    total_users: int
    active_users: int
    total_reviews: int
    hidden_reviews: int
    total_interactions: int
    global_avg_rating: float


class RatingBucket(BaseModel):
    rating: int
    count: int
    percentage: float


class GenreStat(BaseModel):
    genre: str
    movie_count: int
    avg_rating: float
    total_views: int


class TopMovieStat(BaseModel):
    id: str
    title: str
    release_year: int
    poster_url: str | None = None
    genres: list[str]
    avg_rating: float
    rating_count: int
    views_count: int


class DecadeStat(BaseModel):
    decade: str
    count: int


class SyncJobSummary(BaseModel):
    pending: int = 0
    running: int = 0
    success: int = 0
    failed: int = 0


class RecentReviewItem(BaseModel):
    id: str
    movie_id: str
    movie_title: str
    user_name: str
    rating: int
    comment: str
    is_hidden: bool
    created_at: datetime


class AdminStatsResponse(BaseModel):
    kpis: AdminOverviewKPIs
    rating_distribution: list[RatingBucket] = Field(default_factory=list)
    top_genres: list[GenreStat] = Field(default_factory=list)
    top_rated_movies: list[TopMovieStat] = Field(default_factory=list)
    movies_by_decade: list[DecadeStat] = Field(default_factory=list)
    sync_jobs: SyncJobSummary
    recent_reviews: list[RecentReviewItem] = Field(default_factory=list)
