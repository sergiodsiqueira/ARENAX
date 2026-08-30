from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://arenax:arenax@localhost:5432/arenax"
    web_origin: str = "http://localhost:5173"
    access_cookie_name: str = "arenax_acesso"
    access_cookie_secure: bool = False
    access_duration_hours: int = 12
    persistent_access_duration_days: int = 30
    media_root: str = "/media"
    media_host_path: str = "./media"
    host_agent_url: str = "http://host.docker.internal:8765"
    host_agent_secret: str = ""
    open_cep_url: str = "https://opencep.com/v1"
    mediamtx_api_url: str = "http://localhost:9997"
    mediamtx_public_webrtc_url: str = "http://localhost:8889"
    live_path_secret: str = "change-me-in-production"
    model_config = SettingsConfigDict(env_prefix="ARENAX_", env_file=".env")


settings = Settings()
