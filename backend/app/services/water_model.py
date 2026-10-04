"""OptiFarm water, energy and cost model (requirements section 7).

Pure functions. Mirrors frontend/src/lib/waterModel.ts so the app gives the same numbers
online (backend) and offline (browser); both sides are unit-tested.
"""

from __future__ import annotations

import calendar
import math
from datetime import date, timedelta
from typing import Any

from .solar import from_minutes, overlap_share, solar_window_for_date, to_minutes

METHODS = ("flood", "drip", "precision")
WATER_DENSITY = 1000.0  # kg/m3
G = 9.81  # m/s2
J_PER_KWH = 3.6e6
DAWN_START_MIN = 6 * 60
ZONE_PRIORITY = {"critical": 0, "moderate": 1, "healthy": 2, "waterlogged": 3}

Assumptions = dict[str, float]


# ------------------------------------------------------------------ 1. crop coefficient


def kc_for_day(crop: dict[str, Any], das: int) -> tuple[float, str] | None:
    """FAO-56 style Kc curve; None before sowing or after harvest."""
    if das < 0 or das >= crop["duration_days"]:
        return None
    ini, dev, mid, late = crop["growth_stages"]
    d = das
    if d < ini["days"]:
        return ini["kc"], "initial"
    d -= ini["days"]
    if d < dev["days"]:
        return ini["kc"] + (mid["kc"] - ini["kc"]) * d / dev["days"], "development"
    d -= dev["days"]
    if d < mid["days"]:
        return mid["kc"], "mid"
    d -= mid["days"]
    frac = min(1.0, d / late["days"])
    return mid["kc"] + (late["kc"] - mid["kc"]) * frac, "late"


# ------------------------------------------------------------------ 2. net requirement


def effective_rain(rain_mm: float, a: Assumptions) -> float:
    return a["effective_rain_factor"] * rain_mm if rain_mm > a["effective_rain_min_mm"] else 0.0


def net_requirement_mm(et0: float, kc: float, rain_mm: float, a: Assumptions) -> float:
    return max(0.0, et0 * kc - effective_rain(rain_mm, a))


# ------------------------------------------------------------------ 3. zone factor


def zone_factor(label: str, a: Assumptions) -> float:
    return a[f"zone_factor_{label}"]


# ------------------------------------------------------------------ 4-6. gross, volume, energy


def efficiency(method: str, a: Assumptions) -> float:
    return {"flood": a["efficiency_flood"], "drip": a["efficiency_drip"], "precision": a["efficiency_precision"]}[method]


def gross_mm(net_mm: float, eff: float) -> float:
    return net_mm / eff if eff > 0 else 0.0


def litres_from_mm(mm: float, area_m2: float) -> float:
    """1 mm of water over 1 m2 is 1 litre."""
    return mm * area_m2


def pump_energy_kwh(litres: float, a: Assumptions) -> float:
    volume_m3 = litres / 1000.0
    return (volume_m3 * WATER_DENSITY * G * a["pump_head_m"]) / (J_PER_KWH * a["pump_efficiency"])


# ------------------------------------------------------------------ 7-8. cost and savings


def energy_cost_inr(kwh: float, solar_share: float, pump_type: str, a: Assumptions) -> float:
    if pump_type == "diesel":
        return kwh * a["diesel_litres_per_kwh"] * a["diesel_price_inr_per_litre"]
    if pump_type == "solar":
        return kwh * solar_share * a["solar_marginal_inr_per_kwh"] + kwh * (1 - solar_share) * a["grid_tariff_inr_per_kwh"]
    return kwh * a["grid_tariff_inr_per_kwh"]


def saving_pct(baseline: float, proposed: float) -> float:
    return (baseline - proposed) / baseline * 100 if baseline > 0 else 0.0


# ------------------------------------------------------------------ helpers


def days_between(from_iso: str, to_iso: str) -> int:
    return (date.fromisoformat(to_iso) - date.fromisoformat(from_iso)).days


def zones_by_priority(zones: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(zones, key=lambda z: (ZONE_PRIORITY[z["label"]], -z.get("stress_score", 0)))


def lifecycle_skip(crop: dict[str, Any], das: int) -> str | None:
    if das < 0:
        return "not_sown"
    if das >= crop["duration_days"]:
        return "harvested"
    if das >= crop["duration_days"] - crop["stop_irrigation_days_before_harvest"]:
        return "pre_harvest"
    return None


# ------------------------------------------------------------------ 7-day plan


def build_plan(
    crop: dict[str, Any],
    zones: list[dict[str, Any]],
    sowing_date: str,
    pump: dict[str, Any],
    weather: dict[str, Any],
    a: Assumptions,
    days: int = 7,
) -> dict[str, Any]:
    eff = a["efficiency_precision"]
    ordered = zones_by_priority(zones)
    times = weather["hourly"]["time"]
    radiation = weather["hourly"]["shortwave_radiation_wm2"]
    out_days = []

    for w in weather["daily"][:days]:
        das = days_between(sowing_date, w["date"])
        kc_res = kc_for_day(crop, das)
        life = lifecycle_skip(crop, das)
        window = solar_window_for_date(times, radiation, w["date"], a["solar_threshold_wm2"])
        net = net_requirement_mm(w["et0_mm"], kc_res[0], w["rain_mm"], a) if kc_res else 0.0
        rain_skip = w["rain_mm"] >= a["rain_skip_threshold_mm"]
        cursor = float(to_minutes(window["start"])) if pump["type"] == "solar" and window else float(DAWN_START_MIN)

        cells = []
        for z in ordered:
            base = {
                "date": w["date"],
                "zone_id": z["zone_id"],
                "net_mm": 0.0,
                "gross_mm": 0.0,
                "litres": 0.0,
                "kwh": 0.0,
                "start_time": None,
                "duration_min": 0,
                "solar_window": {"start": window["start"], "end": window["end"]} if window else None,
                "solar_share": 0.0,
            }
            reason = life or ("rain" if rain_skip else None)
            factor = zone_factor(z["label"], a)
            if reason is None and factor <= 0:
                reason = "waterlogged"
            net_z = net * factor
            if reason is None and net_z < a["min_irrigation_mm"]:
                reason = "no_need"
            if reason is not None:
                cells.append({**base, "action": "skip", "reason_key": reason})
                continue

            g = gross_mm(net_z, eff)
            litres = litres_from_mm(g, z["area_ha"] * 10_000)
            kwh = pump_energy_kwh(litres, a)
            duration = kwh / pump["power_kw"] * 60 if pump["power_kw"] > 0 else 0.0
            start = cursor
            cursor += duration
            cells.append(
                {
                    **base,
                    "action": "irrigate",
                    "reason_key": "irrigate",
                    "net_mm": net_z,
                    "gross_mm": g,
                    "litres": litres,
                    "kwh": kwh,
                    "start_time": from_minutes(start),
                    "duration_min": math.ceil(duration),
                    "solar_share": overlap_share(start, duration, window) if pump["type"] == "solar" else 0.0,
                }
            )

        out_days.append(
            {
                "date": w["date"],
                "et0_mm": w["et0_mm"],
                "rain_mm": w["rain_mm"],
                "temp_max_c": w["temp_max_c"],
                "kc": kc_res[0] if kc_res else 0.0,
                "stage": kc_res[1] if kc_res else None,
                "days_after_sowing": das,
                "heat_alert": w["temp_max_c"] > crop["heat_tolerance_max_c"],
                "solar_window": window,
                "cells": cells,
                "total_litres": sum(c["litres"] for c in cells),
                "total_kwh": sum(c["kwh"] for c in cells),
            }
        )

    total_kwh = sum(d["total_kwh"] for d in out_days)
    solar_kwh = sum(c["kwh"] * c["solar_share"] for d in out_days for c in d["cells"])
    return {
        "days": out_days,
        "total_litres": sum(d["total_litres"] for d in out_days),
        "total_kwh": total_kwh,
        "solar_share": solar_kwh / total_kwh if total_kwh > 0 else 0.0,
    }


# ------------------------------------------------------------------ season what-if


def climatology_rain(d: date, climate: dict[str, Any]) -> float:
    """Monthly rainfall split into equal events of ~rain_event_mm spread evenly."""
    total = climate["rain_mm_month"][d.month - 1]
    days_in_month = calendar.monthrange(d.year, d.month)[1]
    n = round(total / climate["rain_event_mm"])
    if n <= 0:
        return 0.0
    is_event = (d.day * n) // days_in_month != ((d.day - 1) * n) // days_in_month
    return total / n if is_event else 0.0


def season_impact(
    crop: dict[str, Any],
    zones: list[dict[str, Any]],
    sowing_date: str,
    pump: dict[str, Any],
    a: Assumptions,
    climate: dict[str, Any],
) -> dict[str, Any]:
    """Season totals per hectare for flood (baseline), uniform drip and OptiFarm precision."""
    area_ha = sum(z["area_ha"] for z in zones) or 1.0
    start = date.fromisoformat(sowing_date)
    result: dict[str, Any] = {}

    for method in METHODS:
        eff = efficiency(method, a)
        litres = kwh = cost = solar_kwh = 0.0
        weekly: list[float] = []
        for das in range(crop["duration_days"]):
            d = start + timedelta(days=das)
            month = d.month - 1
            kc_res = kc_for_day(crop, das)
            rain = climatology_rain(d, climate)
            day_litres = 0.0
            skip_life = lifecycle_skip(crop, das) is not None
            if kc_res and not skip_life and not (method == "precision" and rain >= a["rain_skip_threshold_mm"]):
                net = net_requirement_mm(climate["et0_mm_day"][month], kc_res[0], rain, a)
                for z in zones:
                    factor = zone_factor(z["label"], a) if method == "precision" else 1.0
                    net_z = net * factor
                    if net_z < a["min_irrigation_mm"]:
                        continue
                    day_litres += litres_from_mm(gross_mm(net_z, eff), z["area_ha"] * 10_000)
            day_kwh = pump_energy_kwh(day_litres, a)
            share = 0.0
            if pump["type"] == "solar" and day_kwh > 0:
                if method == "precision":
                    run_hours = day_kwh / pump["power_kw"] if pump["power_kw"] > 0 else math.inf
                    share = min(1.0, climate["solar_hours_day"][month] / run_hours)
                else:
                    share = a["unscheduled_solar_share"]
            litres += day_litres
            kwh += day_kwh
            solar_kwh += day_kwh * share
            cost += energy_cost_inr(day_kwh, share, pump["type"], a)
            if (das + 1) % 7 == 0 or das == crop["duration_days"] - 1:
                weekly.append(litres / area_ha)

        result[method] = {
            "method": method,
            "litres_per_ha": litres / area_ha,
            "kwh_per_ha": kwh / area_ha,
            "cost_inr_per_ha": cost / area_ha,
            "solar_share": solar_kwh / kwh if kwh > 0 else 0.0,
            "weekly_cumulative_litres_per_ha": weekly,
        }

    base = result["flood"]
    savings = {
        m: {
            "water_pct": saving_pct(base["litres_per_ha"], result[m]["litres_per_ha"]),
            "energy_pct": saving_pct(base["kwh_per_ha"], result[m]["kwh_per_ha"]),
            "cost_pct": saving_pct(base["cost_inr_per_ha"], result[m]["cost_inr_per_ha"]),
        }
        for m in METHODS
    }
    return {"season_days": crop["duration_days"], "methods": result, "savings_vs_flood": savings}
