from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pymongo.asynchronous.database import AsyncDatabase

from app.core.database import get_db
from app.core.security import get_optional_user
from app.models.assistant import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantSessionOut,
    AssistantStatusOut,
)
from app.services import assistant_service

router = APIRouter(prefix="/assistant", tags=["Tito Concierge (MongoDB RAG)"])


@router.get("/status", response_model=AssistantStatusOut)
async def get_status() -> dict[str, Any]:
    return await assistant_service.get_assistant_status()


@router.post("/chat", response_model=AssistantChatResponse)
async def chat(
    payload: AssistantChatRequest,
    current_user: dict[str, Any] | None = Depends(get_optional_user),
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await assistant_service.chat_with_concierge(
        db,
        message=payload.message,
        session_id=payload.session_id,
        lang=payload.lang,
        current_user=current_user,
    )


@router.get("/sessions/{session_id}", response_model=AssistantSessionOut)
async def get_session(
    session_id: str,
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, Any]:
    return await assistant_service.get_chat_session(db, session_id)


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncDatabase = Depends(get_db),
) -> dict[str, str]:
    return await assistant_service.clear_chat_session(db, session_id)
