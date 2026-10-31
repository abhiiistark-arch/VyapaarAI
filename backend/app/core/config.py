from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "VyapaarAI"
    app_env: str = "development"
    secret_key: str = "dev-secret-change-me"
    token_encrypt_key: str = ""
    access_token_expire_minutes: int = 1440
    database_url: str = "sqlite:///./vyapaarai.db"
    redis_url: str = "redis://localhost:6379/0"

    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000"

    # Flip DEMO_MODE=false + fill Google creds once GBP API access is approved.
    demo_mode: bool = True
    use_live_google: bool = False

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/google/callback"
    google_scopes: str = (
        "https://www.googleapis.com/auth/business.manage openid email profile"
    )

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_fast_model: str = "gemini-3.5-flash-lite"

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def google_scope_list(self) -> List[str]:
        return [scope.strip() for scope in self.google_scopes.split(" ") if scope.strip()]

    @property
    def google_live_enabled(self) -> bool:
        """True only when explicitly enabled and credentials exist."""
        return (
            self.use_live_google
            and not self.demo_mode
            and bool(self.google_client_id)
            and bool(self.google_client_secret)
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
