"""Basic in-memory sliding-window rate limit for the AI endpoints (per client IP)."""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from .config import get_settings

_hits: dict[str, deque[float]] = defaultdict(deque)


def ai_rate_limit(request: Request) -> None:
    limit = get_settings().ai_rate_limit_per_minute
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(status_code=429, detail="Too many AI requests. Please wait a minute.")
    q.append(now)
