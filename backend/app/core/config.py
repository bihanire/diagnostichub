from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Relational Encyclopedia API"
    database_url: str = "sqlite:///./relational_encyclopedia.db"
    cors_origins: str = "http://localhost:3000"
    cors_allow_local_network: bool = True
    seed_on_startup: bool = True
    strict_workflow_validation: bool = True
    strict_data_integrity_validation: bool = True
    log_level: str = "INFO"
    ops_auth_enabled: bool = True
    ops_shared_password: str | None = None
    ops_session_secret: str | None = None
    ops_session_ttl_hours: int = 8
    ops_cookie_name: str = "rel_ops_session"
    ops_cookie_secure: bool = False
    readiness_probe_enabled: bool = True
    readiness_probe_timeout_ms: int = 450
    api_meta_enabled: bool = True
    api_version: str = "1.0.0"
    schema_version: str = "1"
    build_sha: str = "dev"
    request_correlation_enabled: bool = True
    standardize_error_responses: bool = True

    # Google OAuth 2.0
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str = "http://localhost:8000/auth/callback"

    # JWT — set JWT_SECRET to a strong random value in production
    jwt_secret: str = "dev-jwt-secret-replace-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Auth cookies
    auth_cookie_name: str = "dh_auth"
    auth_cookie_secure: bool = False  # True in production (HTTPS)
    auth_reg_cookie_name: str = "dh_reg"
    auth_reg_cookie_expire_minutes: int = 30

    # Frontend base URL (used for OAuth redirects)
    frontend_url: str = "http://localhost:3000"

    # Email OTP auth
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@watu.africa"
    otp_expiry_minutes: int = 3
    otp_dev_log: bool = True  # log OTP to console when SMTP unconfigured

    # Google Sheets sync (Phase 4) — leave unset to disable
    # GOOGLE_SHEETS_CREDENTIALS_JSON: base64-encoded service account JSON key
    google_sheets_credentials_json: str | None = None
    google_sheets_spreadsheet_id: str | None = None
    google_sheets_worksheet_name: str = "Cases"

    # Aramex dispatch webhook (Phase 5) — leave unset to disable
    aramex_webhook_url: str | None = None
    aramex_webhook_secret: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def cors_origin_regex(self) -> str | None:
        if not self.cors_allow_local_network:
            return None

        return (
            r"^https?://("
            r"localhost|127\.0\.0\.1|"
            r"[A-Za-z0-9-]+|"
            r"10\.\d+\.\d+\.\d+|"
            r"192\.168\.\d+\.\d+|"
            r"172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+"
            r")(:\d+)?$"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
