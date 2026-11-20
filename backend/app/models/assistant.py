from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, StrictStr, field_validator

from app.models.movie import MovieOut


class AssistantChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: StrictStr = Field(min_length=1, max_length=600)
    session_id: StrictStr | None = Field(default=None, min_length=4, max_length=120)
    lang: StrictStr = Field(default="vi", pattern="^(vi|en|ja|ko|fr|zh)$")

    @field_validator("message")
    @classmethod
    def clean_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned or "\x00" in cleaned:
            raise ValueError("Message cannot be empty.")
        return cleaned


class AssistantMessageOut(BaseModel):
    role: str
    content: str
    movies: list[MovieOut] = Field(default_factory=list)
    engine: str | None = None
    retrieval_ms: float | None = None
    created_at: datetime


class AssistantChatResponse(BaseModel):
    session_id: str
    reply: str
    movies: list[MovieOut] = Field(default_factory=list)
    engine: str
    retrieval_ms: float
    mongo_filter: dict[str, Any] = Field(default_factory=dict)
    matched_count: int = 0
    follow_up_suggestions: list[str] = Field(default_factory=list)


class AssistantSessionOut(BaseModel):
    session_id: str
    messages: list[AssistantMessageOut] = Field(default_factory=list)
    updated_at: datetime | None = None


class AssistantStatusOut(BaseModel):
    gemini_enabled: bool
    model: str
    mode: str
