from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, status
from pymongo.asynchronous.database import AsyncDatabase

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.interaction import InteractionCreateRequest, InteractionOut
from app.services import interaction_service

router = APIRouter(prefix="/interactions", tags=["Interactions"])


@router.post("", response_model=InteractionOut, status_code=status.HTTP_201_CREATED)
async def record_interaction(
    payload: InteractionCreateRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await interaction_service.create_interaction(db, current_user, payload)
