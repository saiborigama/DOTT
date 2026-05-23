from pathlib import Path

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", Path(".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "DOTT API"
    app_version: str = "5.0.0"
    database_url: str = "sqlite:///./dott.db"
    secret_key: str = "change-me-before-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    public_base_url: str = "http://localhost:8080"
    cors_origins: str = "http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004,http://localhost:5173"
    cors_origin_regex: str = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    gemini_api_key: str = ""
    google_api_key: str = ""
    google_generative_ai_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_image_model: str = "gemini-2.5-flash-image"
    firebase_service_account_json: str = ""
    otp_email_host: str = ""
    otp_email_port: int = 587
    otp_email_user: str = ""
    otp_email_password: str = ""
    otp_email_from: str = ""
    otp_email_from_name: str = "DDOTT Updates"
    otp_email_use_tls: bool = True

    @field_validator("public_base_url")
    @classmethod
    def normalize_public_base_url(cls, value: str) -> str:
        return value.rstrip("/")

    @property
    def cors_origin_list(self) -> list[str]:
        value = self.cors_origins
        if isinstance(value, list):
            return value
        raw = str(value or "").strip()
        if raw.startswith("["):
            import json
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            except Exception:
                pass
        return [item.strip() for item in raw.split(",") if item.strip()]

    @model_validator(mode="after")
    def validate_production_security(self):
        public_url = (self.public_base_url or "").lower()
        local_hosts = ("localhost", "127.0.0.1")
        is_local = any(host in public_url for host in local_hosts)
        if not is_local and self.secret_key == "change-me-before-production":
            raise ValueError(
                "Set a strong SECRET_KEY environment variable before using a non-local PUBLIC_BASE_URL."
            )
        return self


settings = Settings()
