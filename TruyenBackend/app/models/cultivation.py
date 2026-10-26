from sqlalchemy import JSON, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.constants.database import Base


class CultivationGuide(Base):
    __tablename__ = "cultivation_guides"
    book_id: Mapped[str] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"), primary_key=True
    )
    title: Mapped[str] = mapped_column(String(200))
    version: Mapped[str] = mapped_column(String(40))
    updated_at: Mapped[str] = mapped_column(String(10))
    intro: Mapped[str] = mapped_column(Text)
    source_note: Mapped[str] = mapped_column(Text)
    sources: Mapped[list] = mapped_column(JSON)


class RealmSystem(Base):
    __tablename__ = "realm_systems"
    __table_args__ = (UniqueConstraint("book_id", "position"),)
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    book_id: Mapped[str] = mapped_column(
        ForeignKey("cultivation_guides.book_id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int]
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    verification: Mapped[str] = mapped_column(String(200))
    source_ids: Mapped[list] = mapped_column(JSON)


class CultivationRealm(Base):
    __tablename__ = "cultivation_realms"
    __table_args__ = (UniqueConstraint("system_id", "position"),)
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    system_id: Mapped[str] = mapped_column(
        ForeignKey("realm_systems.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int]
    name: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str] = mapped_column(Text)
    branch: Mapped[str] = mapped_column(String(100))
    aliases: Mapped[list] = mapped_column(JSON)
    source_ids: Mapped[list] = mapped_column(JSON)
