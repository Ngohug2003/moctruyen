from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SourceOut(BaseModel):
    id: str
    title: str
    url: str
    kind: Literal["novel", "reference"]
    chapter_position: int | None


class RealmOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    position: int
    name: str
    detail: str
    branch: str
    aliases: list[str]
    source_ids: list[str]


class RealmSystemOut(BaseModel):
    id: str
    position: int
    title: str
    summary: str
    verification: str
    source_ids: list[str]
    realms: list[RealmOut] = Field(max_length=100)


class CultivationOut(BaseModel):
    book_id: str
    title: str
    version: str
    updated_at: str
    intro: str
    source_note: str
    sources: list[SourceOut] = Field(max_length=100)
    systems: list[RealmSystemOut] = Field(max_length=30)
