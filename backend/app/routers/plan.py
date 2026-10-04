from fastapi import APIRouter, HTTPException

from ..data import climate, crops_by_id, default_assumptions
from ..models.schemas import PlanRequest, PlanResponse
from ..services.water_model import build_plan, season_impact
from ..services.weather import get_weather

router = APIRouter(prefix="/api", tags=["plan"])


@router.post("/plan", response_model=PlanResponse)
async def plan(req: PlanRequest) -> PlanResponse:
    """7-day zone plan plus season impact for flood, uniform drip and OptiFarm precision."""
    crop = crops_by_id().get(req.crop_id)
    if crop is None:
        raise HTTPException(404, f"Unknown crop_id '{req.crop_id}'.")
    defaults = default_assumptions()
    unknown = set(req.assumptions) - set(defaults)
    if unknown:
        raise HTTPException(422, f"Unknown assumption keys: {sorted(unknown)}")
    a = {**defaults, **req.assumptions}

    weather = req.weather.model_dump() if req.weather else await get_weather(req.field.lat, req.field.lng)
    zones = [z.model_dump() for z in req.field.zones]
    pump = req.pump.model_dump()
    sowing = req.sowing_date.isoformat()

    return PlanResponse(
        crop_id=crop["id"],
        weather_source=weather["source"],
        assumptions=a,
        plan=build_plan(crop, zones, sowing, pump, weather, a),
        impact=season_impact(crop, zones, sowing, pump, a, climate()),
    )
