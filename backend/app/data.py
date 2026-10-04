"""Loads the shared static JSON data once per process."""

import json
from functools import lru_cache
from typing import Any

from .config import get_settings


def _load(name: str) -> Any:
    path = get_settings().data_dir / name
    with path.open(encoding="utf-8") as f:
        return json.load(f)


@lru_cache
def crops() -> list[dict[str, Any]]:
    return _load("crops.json")["crops"]


@lru_cache
def crops_by_id() -> dict[str, dict[str, Any]]:
    return {c["id"]: c for c in crops()}


@lru_cache
def default_assumptions() -> dict[str, float]:
    return _load("assumptions.json")


@lru_cache
def climate() -> dict[str, Any]:
    return _load("climate.json")


@lru_cache
def weather_fallback() -> dict[str, Any]:
    return _load("weatherFallback.json")
