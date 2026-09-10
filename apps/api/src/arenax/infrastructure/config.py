from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://arenax:arenax@localhost:5432/arenax"
    web_origin: str = "http://localhost:5173"
    web_origin_regex: str = (
        r"^https?://(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|"
        r"192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})"
        r"(?::\d{1,5})?$"
    )
    access_cookie_name: str = "arenax_acesso"
    access_cookie_secure: bool = False
    access_duration_hours: int = 12
    persistent_access_duration_days: int = 30
    password_reset_duration_minutes: int = 30
    expose_local_password_reset_url: bool = True
    media_root: str = "/media"
    media_host_path: str = "./media"
    host_agent_url: str = "http://host.docker.internal:8765"
    host_agent_secret: str = ""
    open_cep_url: str = "https://opencep.com/v1"
    license_api_url: str = "https://license.sergiodsiqueira.workers.dev/api/v1/licencas"
    mediamtx_api_url: str = "http://localhost:9997"
    mediamtx_public_webrtc_url: str = "http://localhost:8889"
    live_path_secret: str = "change-me-in-production"
    model_config = SettingsConfigDict(env_prefix="ARENAX_", env_file=".env")


settings = Settings()
