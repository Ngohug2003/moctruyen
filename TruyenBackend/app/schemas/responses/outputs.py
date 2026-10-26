from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class GenericResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "Success"
    error_code: str = "SUCCESS"
    data: T


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class BookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    total: int
    version: str


class ChapterMeta(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    position: int
    number: int
    title: str


class ChapterOut(ChapterMeta):
    content: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    name: str


class AuthOut(BaseModel):
    token: str
    user: UserOut


class ProgressOut(BaseModel):
    book_id: str
    chapter_id: str
    title: str
    position: int
    version: str
    ratio: float
    pixel: float
    location_kind: str
    revision: int
    updated_at: datetime


class ChapterPreview(BaseModel):
    position: int
    number: int
    title: str
    excerpt: str


class BookPreviewOut(BaseModel):
    id: str
    title: str
    total: int
    version: str
    duration_seconds: float
    first_chapters: list[ChapterPreview]
    last_chapters: list[ChapterPreview]


class BookUploadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    total: int
    version: str
    duration_seconds: float
    exported_chunks: bool
    message: str
