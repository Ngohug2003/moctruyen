from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.constants.database import Base


class Book(Base):
    __tablename__ = "books"
    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    total: Mapped[int]
    version: Mapped[str] = mapped_column(String(64))


class Chapter(Base):
    __tablename__ = "chapters"
    __table_args__ = (UniqueConstraint("book_id", "position"), UniqueConstraint("book_id", "id"))
    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id"), index=True)
    position: Mapped[int]
    number: Mapped[int]
    title: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(default=True)


class LoginSession(Base):
    __tablename__ = "login_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Progress(Base):
    __tablename__ = "progress"
    __table_args__ = (
        CheckConstraint("ratio >= 0 AND ratio <= 1"),
        CheckConstraint("pixel >= 0"),
        ForeignKeyConstraint(
            ["book_id", "chapter_id"],
            ["chapters.book_id", "chapters.id"],
            name="fk_progress_chapter_book",
        ),
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    book_id: Mapped[str] = mapped_column(ForeignKey("books.id"), primary_key=True)
    chapter_id: Mapped[str] = mapped_column(ForeignKey("chapters.id"))
    ratio: Mapped[float] = mapped_column(default=0)
    pixel: Mapped[float] = mapped_column(default=0)
    location_kind: Mapped[str] = mapped_column(String(8))
    version: Mapped[str] = mapped_column(String(64))
    revision: Mapped[int] = mapped_column(default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
