from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from pathlib import Path
import os


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    anthropic_api_key: str = ""  # Anthropic API key for Claude vision
    cors_origins: list[str] = ["http://localhost:5174", "http://localhost:5173", "http://localhost:3000"]
    frontend_url: str = ""  # Production frontend URL

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    def get_cors_origins(self) -> list[str]:
        """Get all CORS origins including production frontend URL."""
        origins = list(self.cors_origins)
        if self.frontend_url and self.frontend_url not in origins:
            origins.append(self.frontend_url)
        return origins

    class Config:
        env_file = Path(__file__).parent.parent / ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
