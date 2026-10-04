from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """All configuration comes from environment variables (or a .env file)."""

    model_config = SettingsConfigDict(env_file=(REPO_DIR / ".env", BACKEND_DIR / ".env"), extra="ignore")

    # Held server-side only; never sent to the frontend.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5-5"

    frontend_origins: str = "http://localhost:5173,http://localhost:4173"
    # Shared JSON data (crop DB, assumptions, climate, weather fallback) lives with the
    # frontend so both sides read the same single source of truth.
    data_dir: Path = REPO_DIR / "frontend" / "src" / "data"
    cache_dir: Path = BACKEND_DIR / ".cache"
    # Built frontend (frontend/dist) to serve from the same origin, e.g. on Render.
    # Unset in local development, where Vite serves the frontend.
    static_dir: Path | None = None

    ai_rate_limit_per_minute: int = 20
    max_image_mb: float = 6.0
    weather_ttl_minutes: int = 30

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]

    @property
    def ai_configured(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
