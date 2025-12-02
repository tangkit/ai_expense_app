"""Application configuration using Pydantic Settings."""

from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignore extra env vars not defined in this class
    )

    # LLM Provider
    llm_provider: Literal["anthropic", "openai"] = "anthropic"

    # API Keys
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Model names
    anthropic_model: str = "claude-sonnet-4-20250514"
    openai_model: str = "gpt-4o"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # File uploads
    max_file_size_mb: int = 10
    allowed_file_types: str = "image/jpeg,image/png,image/webp,application/pdf"

    # Business rules
    meal_companion_threshold: float = 25.0

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def allowed_file_types_list(self) -> list[str]:
        """Parse allowed file types into a list."""
        return [ft.strip() for ft in self.allowed_file_types.split(",")]

    @property
    def max_file_size_bytes(self) -> int:
        """Get max file size in bytes."""
        return self.max_file_size_mb * 1024 * 1024


settings = Settings()
