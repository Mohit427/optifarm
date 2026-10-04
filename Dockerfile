# OptiFarm: one container serving the FastAPI backend and the built PWA frontend.

# ---- 1. Build the frontend ------------------------------------------------------------
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2. Runtime -----------------------------------------------------------------------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/app/data \
    STATIC_DIR=/app/static \
    CACHE_DIR=/tmp/optifarm-cache
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
# Shared JSON data (crop DB, assumptions, climate, weather fallback).
COPY frontend/src/data ./data
COPY --from=web /web/dist ./static

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
# Render sets $PORT. Proxy headers give the rate limiter the real client IP.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
