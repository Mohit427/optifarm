from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

Lang = Literal["en", "ta", "hi"]
ZoneLabel = Literal["critical", "moderate", "healthy", "waterlogged"]
PumpType = Literal["grid", "diesel", "solar"]
NavTarget = Literal["seed", "field", "zones", "plan", "impact"]


# ------------------------------------------------------------------ seed


class SeedMatch(BaseModel):
    crop_id: str
    confidence: float = Field(ge=0, le=1)


class SeedIdentifyResponse(BaseModel):
    top_matches: list[SeedMatch] = Field(max_length=3)


# ------------------------------------------------------------------ weather


class DailyWeather(BaseModel):
    date: str
    et0_mm: float
    rain_mm: float
    temp_max_c: float
    temp_min_c: float


class HourlyWeather(BaseModel):
    time: list[str]
    shortwave_radiation_wm2: list[float]


class Weather(BaseModel):
    source: Literal["live", "cached", "sample"]
    fetched_at: str
    lat: float
    lng: float
    daily: list[DailyWeather]
    hourly: HourlyWeather


# ------------------------------------------------------------------ plan


class ZoneIn(BaseModel):
    zone_id: str
    label: ZoneLabel
    area_ha: float = Field(gt=0, le=1000)
    stress_score: float = Field(default=0.5, ge=0, le=1)


class FieldIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    zones: list[ZoneIn] = Field(min_length=1, max_length=20)


class PumpIn(BaseModel):
    type: PumpType = "grid"
    power_kw: float = Field(default=3.7, gt=0, le=100)


class PlanRequest(BaseModel):
    field: FieldIn
    crop_id: str
    sowing_date: date
    pump: PumpIn = PumpIn()
    # Any subset of the assumptions; missing keys use the defaults in assumptions.json.
    assumptions: dict[str, float] = Field(default_factory=dict)
    # Optional forecast; when omitted the backend fetches it for the field location.
    weather: Weather | None = None

    @field_validator("assumptions")
    @classmethod
    def non_negative(cls, v: dict[str, float]) -> dict[str, float]:
        if any(x < 0 for x in v.values()):
            raise ValueError("assumption values must be >= 0")
        return v


class PlanResponse(BaseModel):
    crop_id: str
    weather_source: str
    assumptions: dict[str, float]
    plan: dict[str, Any]
    impact: dict[str, Any]


# ------------------------------------------------------------------ chat


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[ChatTurn] = Field(min_length=1, max_length=10)
    language: Lang = "en"
    context: dict[str, Any] = Field(default_factory=dict)


class ChatAction(BaseModel):
    type: Literal["navigate"] = "navigate"
    target: NavTarget


class ChatResponse(BaseModel):
    reply: str
    action: ChatAction | None = None


class HealthResponse(BaseModel):
    status: Literal["ok"]
    ai_configured: bool
    model: str
    crops: int
