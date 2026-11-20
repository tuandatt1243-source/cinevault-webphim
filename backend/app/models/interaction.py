from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr


class InteractionCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    movie_id: StrictStr
    type: Literal["VIEW", "WATCH", "LIKE", "WATCHLIST_ADD"]
    duration_sec: StrictInt = Field(default=0, ge=0, le=86400)


class InteractionOut(BaseModel):
    id: str
    user_id: str
    movie_id: str
    type: Literal["VIEW", "WATCH", "LIKE", "WATCHLIST_ADD"]
    duration_sec: int
    created_at: datetime
