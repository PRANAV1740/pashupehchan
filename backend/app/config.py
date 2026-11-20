"""Application configuration.

Values come from environment variables so the same code runs against SQLite in
development and Postgres in production without edits.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
MEDIA_DIR = BACKEND_DIR / "media"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PASHU_", env_file=".env", extra="ignore")

    database_url: str = f"sqlite:///{(BACKEND_DIR / 'pashupehchan.db').as_posix()}"
    media_dir: str = str(MEDIA_DIR)

    # Identity thresholds. Tuned conservatively; fine-tune on field data later.
    match_accept_threshold: float = 0.72   # cosine similarity to call it a confident match
    match_review_threshold: float = 0.55   # below accept but above this -> send to a human
    quality_min_sharpness: float = 60.0    # variance-of-Laplacian floor
    quality_min_brightness: float = 40.0   # mean luma floor (0-255)
    quality_max_brightness: float = 225.0  # mean luma ceiling (0-255)
    enrol_shots: int = 5

    @property
    def media_path(self) -> Path:
        p = Path(self.media_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p


@lru_cache
def get_settings() -> Settings:
    return Settings()
