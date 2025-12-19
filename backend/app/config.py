from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    anthropic_api_key: str = ""  # Anthropic API key for Claude vision
    cors_origins: list[str] = ["http://localhost:5174", "http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = Path(__file__).parent.parent / ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
