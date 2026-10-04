"""Solar window helpers. Mirrors frontend/src/lib/solarWindow.ts."""

from typing import TypedDict


class SolarWindow(TypedDict):
    start: str
    end: str
    hours: int


def radiation_profile(times: list[str], values: list[float], date: str) -> list[float]:
    out = [0.0] * 24
    for t, v in zip(times, values):
        if t.startswith(date):
            out[int(t[11:13])] = v or 0.0
    return out


def solar_window_for_date(
    times: list[str], values: list[float], date: str, threshold_wm2: float
) -> SolarWindow | None:
    """Longest contiguous run of hours with shortwave radiation >= threshold."""
    profile = radiation_profile(times, values, date)
    best: tuple[int, int] | None = None
    run_start = -1
    for h in range(24):
        if profile[h] >= threshold_wm2:
            if run_start < 0:
                run_start = h
            if best is None or h + 1 - run_start > best[1] - best[0]:
                best = (run_start, h + 1)
        else:
            run_start = -1
    if best is None:
        return None
    s, e = best
    return {"start": f"{s:02d}:00", "end": f"{e:02d}:00", "hours": e - s}


def to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def from_minutes(mins: float) -> str:
    m = round(mins) % (24 * 60)
    return f"{m // 60:02d}:{m % 60:02d}"


def overlap_share(start_min: float, duration_min: float, window: SolarWindow | None) -> float:
    if window is None or duration_min <= 0:
        return 0.0
    ws, we = to_minutes(window["start"]), to_minutes(window["end"])
    overlap = max(0.0, min(start_min + duration_min, we) - max(start_min, ws))
    return overlap / duration_min
