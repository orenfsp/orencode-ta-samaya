from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FSP_")

    database_url: str = "postgresql+asyncpg://fsp:fsp@127.0.0.1:5432/fsp"
    redis_url: str = "redis://127.0.0.1:6379/0"
    frontend_url: str = "http://localhost:5173"

    session_ttl_seconds: int = 7 * 24 * 3600
    cookie_secure: bool = False

    pd_consent_version: str = "1.0"

    login_max_attempts: int = 5
    login_window_seconds: int = 15 * 60
    forgot_max_requests: int = 3
    forgot_window_seconds: int = 3600
    reset_token_ttl_seconds: int = 3600

    demo_password: str = "Demo1234"

    s3_endpoint: str = "127.0.0.1:9000"
    s3_public_url: str = "http://localhost:9000"
    s3_access_key: str = "fsp"
    s3_secret_key: str = "fsp-storage-secret"
    s3_public_bucket: str = "fsp-public"
    s3_private_bucket: str = "fsp-private"
    file_max_size_mb: int = 10
    file_signed_url_ttl_seconds: int = 300


settings = Settings()
