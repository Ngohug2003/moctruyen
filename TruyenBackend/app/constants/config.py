from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str
    cors_origins: list[str] = ["http://localhost:5178", "http://127.0.0.1:5178"]


settings = Settings()
