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
    cors_origins: list[str] = [
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        "http://localhost:5173",
    ]
    cors_origin_regex: str = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_image_model: str = "gpt-5"
    image_cleanup_provider: str = "auto"
    remove_bg_api_key: str = ""
    firebase_service_account_json: str = ""
    otp_sms_provider: str = "mock"
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    twilio_messaging_service_sid: str = ""
    twilio_default_country_code: str = "+91"

    @field_validator("public_base_url")
    @classmethod
    def normalize_public_base_url(cls, value: str) -> str:
        return value.rstrip("/")

    @field_validator("openai_base_url")
    @classmethod
    def normalize_openai_base_url(cls, value: str) -> str:
        return value.rstrip("/")

    @field_validator("otp_sms_provider")
    @classmethod
    def normalize_otp_provider(cls, value: str) -> str:
        return (value or "mock").strip().lower()

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def validate_production_security(self):
        public_url = (self.public_base_url or "").lower()
        local_hosts = ("localhost", "127.0.0.1")
        is_local = any(host in public_url for host in local_hosts)
        if not is_local and self.secret_key == "change-me-before-production":
            raise ValueError("Set a strong SECRET_KEY in backend/.env before using a non-local public URL.")
        return self


settings = Settings()
