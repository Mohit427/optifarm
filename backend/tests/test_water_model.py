import json
from datetime import date

import pytest

from app.config import get_settings
from app.data import climate, crops_by_id, default_assumptions
from app.services.solar import overlap_share, solar_window_for_date
from app.services.water_model import (
    build_plan,
    climatology_rain,
    effective_rain,
    energy_cost_inr,
    kc_for_day,
    net_requirement_mm,
    pump_energy_kwh,
    season_impact,
    zone_factor,
)

A = default_assumptions()
PADDY = crops_by_id()["paddy"]
FIELD = json.loads((get_settings().data_dir / "fields.json").read_text(encoding="utf-8"))["fields"][0]
ZONES = FIELD["zones"]


def make_weather(days):
    time, sw, daily = [], [], []
    for i, d in enumerate(days):
        day = f"2026-07-{i + 1:02d}"
        for h in range(24):
            time.append(f"{day}T{h:02d}:00")
            sw.append(700.0 if 10 <= h < 15 else 100.0)
        daily.append({"date": day, "et0_mm": d.get("et0", 5.0), "rain_mm": d["rain"], "temp_max_c": d.get("tmax", 33.0), "temp_min_c": 24.0})
    return {"source": "sample", "daily": daily, "hourly": {"time": time, "shortwave_radiation_wm2": sw}}


# ------------------------------------------------------------------ formulas


def test_effective_rain_threshold_and_factor():
    assert effective_rain(2.0, A) == 0  # at or below 2 mm is ignored
    assert effective_rain(10.0, A) == pytest.approx(8.0)


def test_net_requirement_never_negative():
    assert net_requirement_mm(5.0, 1.2, 0.0, A) == pytest.approx(6.0)
    assert net_requirement_mm(5.0, 1.2, 20.0, A) == 0.0


def test_zone_factors_defaults():
    assert zone_factor("critical", A) == 1.25
    assert zone_factor("moderate", A) == 1.0
    assert zone_factor("healthy", A) == 0.8
    assert zone_factor("waterlogged", A) == 0


def test_pump_energy_formula():
    # 10 m3 through 30 m head at 55 % efficiency
    expected = 10 * 1000 * 9.81 * 30 / (3.6e6 * 0.55)
    assert pump_energy_kwh(10_000, A) == pytest.approx(expected)
    assert pump_energy_kwh(10_000, {**A, "pump_head_m": 60}) == pytest.approx(2 * expected)


def test_energy_cost_by_pump_type():
    assert energy_cost_inr(10, 0, "grid", A) == pytest.approx(45.0)
    assert energy_cost_inr(10, 1.0, "solar", A) == pytest.approx(0.0)
    assert energy_cost_inr(10, 0.5, "solar", A) == pytest.approx(22.5)
    assert energy_cost_inr(10, 0, "diesel", A) == pytest.approx(10 * 0.3 * 92)


def test_kc_stages():
    assert kc_for_day(PADDY, -1) is None
    assert kc_for_day(PADDY, 0) == (1.05, "initial")
    kc, stage = kc_for_day(PADDY, 40)
    assert stage == "development" and 1.05 < kc < 1.2
    assert kc_for_day(PADDY, 60) == (1.2, "mid")
    assert kc_for_day(PADDY, 120) is None


# ------------------------------------------------------------------ plan rules


def test_rain_skip():
    plan = build_plan(PADDY, ZONES, "2026-05-20", {"type": "grid", "power_kw": 3.7}, make_weather([{"rain": 0}, {"rain": 12}]), A)
    wet = plan["days"][1]
    assert all(c["action"] == "skip" and c["reason_key"] == "rain" for c in wet["cells"])
    # Configurable threshold: with 15 mm threshold the 12 mm day is irrigated where needed.
    plan2 = build_plan(PADDY, ZONES, "2026-05-20", {"type": "grid", "power_kw": 3.7}, make_weather([{"rain": 12, "et0": 9}]), {**A, "rain_skip_threshold_mm": 15})
    assert any(c["action"] == "irrigate" for c in plan2["days"][0]["cells"])


def test_zone_allocation_and_waterlogged_skip():
    plan = build_plan(PADDY, ZONES, "2026-05-20", {"type": "grid", "power_kw": 3.7}, make_weather([{"rain": 0}]), A)
    cells = {c["zone_id"]: c for c in plan["days"][0]["cells"]}
    by_label = {z["label"]: z for z in ZONES}
    assert cells[by_label["waterlogged"]["zone_id"]]["reason_key"] == "waterlogged"
    per_ha = lambda label: cells[by_label[label]["zone_id"]]["litres"] / by_label[label]["area_ha"]  # noqa: E731
    assert per_ha("critical") / per_ha("healthy") == pytest.approx(1.25 / 0.8)
    assert per_ha("critical") / per_ha("moderate") == pytest.approx(1.25)


def test_solar_pump_starts_in_window_and_critical_first():
    plan = build_plan(PADDY, ZONES, "2026-05-20", {"type": "solar", "power_kw": 3.7}, make_weather([{"rain": 0}]), A)
    irrigated = [c for c in plan["days"][0]["cells"] if c["action"] == "irrigate"]
    assert irrigated[0]["start_time"] == "10:00"
    critical_id = next(z["zone_id"] for z in ZONES if z["label"] == "critical")
    assert irrigated[0]["zone_id"] == critical_id
    assert 0 < plan["solar_share"] <= 1


def test_stop_before_harvest():
    plan = build_plan(PADDY, ZONES, "2026-03-10", {"type": "grid", "power_kw": 3.7}, make_weather([{"rain": 0}]), A)
    assert all(c["reason_key"] == "pre_harvest" for c in plan["days"][0]["cells"])


def test_heat_alert():
    plan = build_plan(PADDY, ZONES, "2026-05-20", {"type": "grid", "power_kw": 3.7}, make_weather([{"rain": 0, "tmax": 40}]), A)
    assert plan["days"][0]["heat_alert"] is True


# ------------------------------------------------------------------ solar + season


def test_solar_window_and_overlap():
    w = make_weather([{"rain": 0}])
    win = solar_window_for_date(w["hourly"]["time"], w["hourly"]["shortwave_radiation_wm2"], "2026-07-01", 400)
    assert win == {"start": "10:00", "end": "15:00", "hours": 5}
    assert overlap_share(9 * 60, 120, win) == pytest.approx(0.5)


def test_climatology_rain_preserves_monthly_total():
    total = sum(climatology_rain(date(2026, 10, d), climate()) for d in range(1, 32))
    assert total == pytest.approx(climate()["rain_mm_month"][9])


def test_season_ordering_flood_drip_precision():
    imp = season_impact(PADDY, ZONES, "2026-06-15", {"type": "grid", "power_kw": 3.7}, A, climate())
    m = imp["methods"]
    assert m["flood"]["litres_per_ha"] > m["drip"]["litres_per_ha"] > m["precision"]["litres_per_ha"]
    assert m["flood"]["kwh_per_ha"] > m["precision"]["kwh_per_ha"]
    assert imp["savings_vs_flood"]["precision"]["water_pct"] > 50
    assert imp["savings_vs_flood"]["flood"]["water_pct"] == 0
