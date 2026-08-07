from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://arenax:arenax@localhost:5432/arenax"
    model_config = SettingsConfigDict(env_prefix="ARENAX_", env_file=".env")


settings = Settings()

