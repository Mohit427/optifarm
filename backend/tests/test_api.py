from fastapi.testclient import TestClient

from app.main import app
from app.services.chat_context import build_context, normalise_history
from app.services.vision import validate_matches

client = TestClient(app)


def test_health_reports_ai_not_configured():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["ai_configured"] is False and body["crops"] == 10


def test_crops_endpoint():
    r = client.get("/api/crops")
    assert r.status_code == 200
    assert {c["id"] for c in r.json()["crops"]} >= {"paddy", "groundnut", "ragi"}


def test_vision_validation_drops_unknown_and_clamps():
    raw = {
        "top_matches": [
            {"crop_id": "wheat", "confidence": 0.9},  # not in our DB
            {"crop_id": "paddy", "confidence": 1.4},
            {"crop_id": "ragi", "confidence": 0.2},
            {"crop_id": "paddy", "confidence": 0.5},  # duplicate
            {"crop_id": "maize", "confidence": "high"},  # malformed
            {"crop_id": "cotton", "confidence": 0.1},
            {"crop_id": "chilli", "confidence": 0.05},
        ]
    }
    out = validate_matches(raw, {"paddy", "ragi", "maize", "cotton", "chilli"})
    assert out == [
        {"crop_id": "paddy", "confidence": 1.0},
        {"crop_id": "ragi", "confidence": 0.2},
        {"crop_id": "cotton", "confidence": 0.1},
    ]
    assert validate_matches("garbage", {"paddy"}) == []


def test_seed_identify_rejects_non_images():
    r = client.post("/api/seed/identify", files={"image": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 415


def test_seed_identify_degrades_without_ai():
    r = client.post("/api/seed/identify", files={"image": ("s.png", b"\x89PNG fake", "image/png")})
    assert r.status_code == 503


def test_chat_returns_503_without_ai_so_client_uses_faq():
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "How much water today?"}], "language": "ta"})
    assert r.status_code == 503


def test_chat_context_uses_db_crop_record():
    ctx = build_context({"crop_id": "paddy", "field": {"name": "x"}}, "ta")
    assert ctx["selected_crop"]["name_local"] == "நெல்"
    assert ctx["selected_crop"]["water_need_mm_per_season"] == 1200
    assert build_context({"crop_id": "made-up"}, "en")["selected_crop"] is None


def test_history_normalisation():
    h = normalise_history(
        [
            {"role": "assistant", "content": "hi"},
            {"role": "user", "content": "a"},
            {"role": "user", "content": "b"},
            {"role": "assistant", "content": "c"},
            {"role": "user", "content": "d"},
        ]
    )
    assert [m["role"] for m in h] == ["user", "assistant", "user"]
    assert h[0]["content"] == "a\nb"


def test_plan_endpoint_with_supplied_weather():
    weather = {
        "source": "sample",
        "fetched_at": "2026-07-01T00:00:00Z",
        "lat": 10.8,
        "lng": 79.2,
        "daily": [{"date": "2026-07-01", "et0_mm": 5, "rain_mm": 0, "temp_max_c": 33, "temp_min_c": 24}],
        "hourly": {"time": [f"2026-07-01T{h:02d}:00" for h in range(24)], "shortwave_radiation_wm2": [600.0 if 9 <= h < 15 else 0.0 for h in range(24)]},
    }
    body = {
        "field": {"lat": 10.8, "lng": 79.2, "zones": [{"zone_id": "Z1", "label": "critical", "area_ha": 0.5}, {"zone_id": "Z2", "label": "healthy", "area_ha": 1.0}]},
        "crop_id": "maize",
        "sowing_date": "2026-06-01",
        "pump": {"type": "solar", "power_kw": 3.7},
        "assumptions": {"grid_tariff_inr_per_kwh": 6},
        "weather": weather,
    }
    r = client.post("/api/plan", json=body)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["assumptions"]["grid_tariff_inr_per_kwh"] == 6
    cells = out["plan"]["days"][0]["cells"]
    assert cells[0]["zone_id"] == "Z1" and cells[0]["start_time"] == "09:00"
    assert set(out["impact"]["methods"]) == {"flood", "drip", "precision"}


def test_plan_rejects_unknown_crop_and_assumption():
    base = {"field": {"lat": 10, "lng": 78, "zones": [{"zone_id": "Z1", "label": "healthy", "area_ha": 1}]}, "sowing_date": "2026-06-01"}
    assert client.post("/api/plan", json={**base, "crop_id": "wheat"}).status_code == 404
    assert client.post("/api/plan", json={**base, "crop_id": "paddy", "assumptions": {"bogus": 1}}).status_code == 422
