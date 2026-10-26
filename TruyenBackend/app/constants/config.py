import json
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine.url import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str
    cors_origins: Any = ["http://localhost:5178", "http://127.0.0.1:5178"]

    @field_validator("database_url", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Any) -> str:
        if isinstance(v, str):
            v = v.strip()
            try:
                if v.startswith("postgres://"):
                    v = "postgresql://" + v[len("postgres://") :]
                u = make_url(v)
                if u.drivername in ("postgres", "postgresql"):
                    u = u.set(drivername="postgresql+asyncpg")
                if "asyncpg" in u.drivername:
                    query = dict(u.query)
                    if "sslmode" in query:
                        mode = query.pop("sslmode")
                        if mode in ("require", "verify-ca", "verify-full"):
                            query["ssl"] = "require"
                    allowed = {"ssl", "timeout", "command_timeout", "server_settings"}
                    clean_query = {k: val for k, val in query.items() if k in allowed}
                    u = u.set(query=clean_query)
                return u.render_as_string(hide_password=False)
            except Exception:
                return v
        return v

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if v == "*":
                return ["*"]
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()
