"""Open-Meteo forecast with graceful degradation: live -> cached -> bundled sample."""

from __future__ import annotations

import json
import logging
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

from ..config import get_settings
from ..data import weather_fallback

log = logging.getLogger(__name__)

OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
_memory: dict[str, tuple[float, dict[str, Any]]] = {}


def _key(lat: float, lng: float) -> str:
    return f"{lat:.2f}_{lng:.2f}"


def normalise(raw: dict[str, Any]) -> dict[str, Any]:
    d = raw["daily"]
    h = raw["hourly"]
    return {
        "source": "live",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "lat": raw["latitude"],
        "lng": raw["longitude"],
        "daily": [
            {
                "date": t,
                "et0_mm": d["et0_fao_evapotranspiration"][i] or 0.0,
                "rain_mm": d["precipitation_sum"][i] or 0.0,
                "temp_max_c": d["temperature_2m_max"][i] or 0.0,
                "temp_min_c": d["temperature_2m_min"][i] or 0.0,
            }
            for i, t in enumerate(d["time"])
        ],
        "hourly": {
            "time": h["time"],
            "shortwave_radiation_wm2": [v or 0.0 for v in h["shortwave_radiation"]],
        },
    }


def sample_weather(lat: float, lng: float) -> dict[str, Any]:
    """Bundled sample forecast, re-dated so its first day is today."""
    base = weather_fallback()
    today = date.today()
    mapping = {d["date"]: (today + timedelta(days=i)).isoformat() for i, d in enumerate(base["daily"])}
    return {
        **base,
        "source": "sample",
        "lat": lat,
        "lng": lng,
        "daily": [{**d, "date": mapping[d["date"]]} for d in base["daily"]],
        "hourly": {
            "time": [mapping[t[:10]] + t[10:] for t in base["hourly"]["time"]],
            "shortwave_radiation_wm2": base["hourly"]["shortwave_radiation_wm2"],
        },
    }


def _trim_to_today(w: dict[str, Any]) -> dict[str, Any]:
    today = date.today().isoformat()
    keep = [i for i, t in enumerate(w["hourly"]["time"]) if t[:10] >= today]
    return {
        **w,
        "daily": [d for d in w["daily"] if d["date"] >= today],
        "hourly": {
            "time": [w["hourly"]["time"][i] for i in keep],
            "shortwave_radiation_wm2": [w["hourly"]["shortwave_radiation_wm2"][i] for i in keep],
        },
    }


async def get_weather(lat: float, lng: float) -> dict[str, Any]:
    s = get_settings()
    key = _key(lat, lng)
    cached = _memory.get(key)
    if cached and time.time() - cached[0] < s.weather_ttl_minutes * 60:
        return cached[1]

    disk = s.cache_dir / f"weather_{key}.json"
    params = {
        "latitude": round(lat, 4),
        "longitude": round(lng, 4),
        "daily": "et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min",
        "hourly": "shortwave_radiation",
        "timezone": "Asia/Kolkata",
        "forecast_days": 7,
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(OPEN_METEO, params=params)
            r.raise_for_status()
            w = normalise(r.json())
        _memory[key] = (time.time(), w)
        s.cache_dir.mkdir(parents=True, exist_ok=True)
        disk.write_text(json.dumps(w), encoding="utf-8")
        return w
    except (httpx.HTTPError, KeyError, ValueError) as e:
        log.warning("Open-Meteo unavailable (%s); falling back", e)

    if disk.exists():
        try:
            w = _trim_to_today(json.loads(disk.read_text(encoding="utf-8")))
            if len(w["daily"]) >= 3:
                return {**w, "source": "cached"}
        except (ValueError, KeyError):
            pass
    return sample_weather(lat, lng)
