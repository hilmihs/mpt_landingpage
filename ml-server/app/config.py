"""Settings dari env vars. Audio limits disamakan dengan submit route Next.js."""
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Model
    mualim_model_id: str = "obadx/muaalem-model-v3_2"
    mualim_cache_dir: str = "/data/models"
    device: Literal["cuda", "cpu", "auto"] = "auto"

    # Auth — WAJIB, no default. Worker Next.js kirim sebagai Bearer token.
    api_key: str = Field(..., description="Shared secret; sama dengan ML_SERVER_API_KEY di Vercel")

    # Audio
    max_audio_duration_sec: int = 320  # match validasi submit route Next.js
    min_audio_duration_sec: int = 5
    max_audio_bytes: int = 25 * 1024 * 1024  # 25 MB, match submit route
    target_sample_rate: int = 16000
    download_timeout_sec: int = 30


settings = Settings()
