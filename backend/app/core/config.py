from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Relational Encyclopedia API"
    database_url: str = "sqlite:///./relational_encyclopedia.db"
    cors_origins: str = "http://localhost:3000"
    cors_allow_local_network: bool = True
    seed_on_startup: bool = True
    strict_workflow_validation: bool = True
    log_level: str = "INFO"
    ops_auth_enabled: bool = True
    ops_shared_password: str | None = None
    ops_session_secret: str | None = None
    ops_session_ttl_hours: int = 8
    ops_cookie_name: str = "rel_ops_session"
    ops_cookie_secure: bool = False

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
