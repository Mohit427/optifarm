"""Shared Anthropic client and a structured-output helper.

The API key is read from the environment on the server only.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any

import anthropic

from ..config import get_settings

log = logging.getLogger(__name__)


class AIUnavailable(Exception):
    """AI is not configured, unreachable, or returned something unusable."""


class AIRefused(Exception):
    """The model declined the request (stop_reason == 'refusal')."""


@lru_cache
def _client() -> anthropic.AsyncAnthropic:
    s = get_settings()
    return anthropic.AsyncAnthropic(api_key=s.anthropic_api_key, timeout=40.0, max_retries=1)


async def structured_call(
    *,
    system: str | list[dict[str, Any]],
    messages: list[dict[str, Any]],
    schema: dict[str, Any],
    max_tokens: int = 2048,
) -> dict[str, Any]:
    """One Messages API call constrained to a JSON schema; returns the parsed object."""
    s = get_settings()
    if not s.ai_configured:
        raise AIUnavailable("ANTHROPIC_API_KEY is not set")
    try:
        resp = await _client().beta.messages.create(
            model=s.anthropic_model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
            # Short classification / chat turns: low effort keeps latency and cost down.
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": schema}},
            # Server-side fallback if a safety classifier declines the request.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.RateLimitError as e:
        raise AIUnavailable("rate limited") from e
    except anthropic.APIStatusError as e:
        log.warning("Anthropic API error %s: %s", e.status_code, e.message)
        raise AIUnavailable(f"api error {e.status_code}") from e
    except anthropic.APIConnectionError as e:
        raise AIUnavailable("connection error") from e

    if resp.stop_reason == "refusal":
        raise AIRefused()
    text = next((b.text for b in resp.content if b.type == "text"), None)
    if not text:
        raise AIUnavailable(f"no text in response (stop_reason={resp.stop_reason})")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise AIUnavailable("invalid JSON from model") from e
