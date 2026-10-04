from typing import Any

from fastapi import APIRouter, Query

from ..config import get_settings
from ..data import crops
from ..models.schemas import HealthResponse, Weather
from ..services.weather import get_weather

router = APIRouter(prefix="/api", tags=["data"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    s = get_settings()
    return HealthResponse(status="ok", ai_configured=s.ai_configured, model=s.anthropic_model, crops=len(crops()))


@router.get("/crops")
async def get_crops() -> dict[str, Any]:
    """The curated crop database (also bundled in the frontend for offline use)."""
    return {"crops": crops()}


@router.get("/weather", response_model=Weather)
async def weather(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> dict[str, Any]:
    """Normalised 7-day forecast (ET0, rain, temperature, hourly shortwave radiation)."""
    return await get_weather(lat, lng)
