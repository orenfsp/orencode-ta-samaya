from typing import Literal

from pydantic import SecretStr
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


    s3_endpoint: str = "127.0.0.1:9000"
    s3_public_url: str = "http://localhost:9000"
    s3_access_key: str = "fsp"
    s3_secret_key: str = "fsp-storage-secret"
    s3_public_bucket: str = "fsp-public"
    s3_private_bucket: str = "fsp-private"
    file_max_size_mb: int = 10
    file_signed_url_ttl_seconds: int = 300

    smtp_host: str = "127.0.0.1"
    smtp_port: int = 1025
    smtp_sender: str = "ФСП Оренбург <no-reply@fsp.local>"
    smtp_tls_mode: Literal["none", "starttls", "ssl"] = "none"
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    mail_worker_enabled: bool = True
    deadline_thresholds_days: tuple[int, ...] = (30, 7, 1)
    deadline_interval_seconds: int = 3600

    document_signing_secret: SecretStr = SecretStr("dev-document-secret-change-me")
    code_ttl_seconds: int = 15 * 60
    code_max_attempts: int = 5
    code_resend_seconds: int = 60
    reset_session_ttl_seconds: int = 10 * 60

    telegram_bot_token: SecretStr | None = None
    telegram_bot_username: str = "FSP_Oren_bot"
    telegram_link_ttl_seconds: int = 10 * 60
    mailpit_url: str | None = "http://localhost:8025"

    codeforces_enabled: bool = True
    codeforces_api_url: str = "https://codeforces.com/api"
    codeforces_interval_seconds: int = 3600
    codeforces_batch: int = 300
    codeforces_pause_seconds: float = 2.0

    squad_region: str = "Оренбургской области"


settings = Settings()
