from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class Registration(Credentials):
    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value):
        if not value.strip():
            raise ValueError("Name is required")
        return value.strip()

    name: str = Field(min_length=1, max_length=80)


class ProgressInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    chapter_id: str = Field(min_length=16, max_length=16)
    version: str = Field(max_length=64)
    location_kind: Literal["ratio", "pixel"]
    location_value: float = Field(ge=0, allow_inf_nan=False)
    expected_revision: int = Field(ge=0)
