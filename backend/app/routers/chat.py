from fastapi import APIRouter, Depends, HTTPException

from ..models.schemas import ChatAction, ChatRequest, ChatResponse
from ..ratelimit import ai_rate_limit
from ..services.ai import AIRefused, AIUnavailable, structured_call
from ..services.chat_context import (
    REFUSAL_TEXT,
    RESPONSE_SCHEMA,
    build_context,
    build_system,
    normalise_history,
)

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(ai_rate_limit)])
async def chat(req: ChatRequest) -> ChatResponse:
    """Grounded assistant reply. No chat history is stored on the server."""
    history = normalise_history([m.model_dump() for m in req.messages])
    if not history or history[-1]["role"] != "user":
        raise HTTPException(422, "The last message must be from the user.")
    context = build_context(req.context, req.language)
    try:
        out = await structured_call(
            system=build_system(context, req.language),
            messages=history,
            schema=RESPONSE_SCHEMA,
            max_tokens=1024,
        )
    except AIRefused:
        return ChatResponse(reply=REFUSAL_TEXT[req.language], action=None)
    except AIUnavailable as e:
        # 503 tells the client to use its offline FAQ matcher.
        raise HTTPException(503, f"Assistant unavailable ({e}).") from e

    reply = str(out.get("reply", "")).strip() or REFUSAL_TEXT[req.language]
    target = out.get("navigate_to")
    action = ChatAction(target=target) if target in {"seed", "field", "zones", "plan", "impact"} else None
    return ChatResponse(reply=reply, action=action)
