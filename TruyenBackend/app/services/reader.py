from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError

from app.models.entities import Progress
from app.repositories import accounts as repo
from app.repositories import catalog
from app.utils.errors import DomainError


def output(p, c):
    return dict(
        book_id=p.book_id,
        chapter_id=p.chapter_id,
        title=c.title,
        position=c.position,
        version=p.version,
        ratio=p.ratio,
        pixel=p.pixel,
        location_kind=p.location_kind,
        revision=p.revision,
        updated_at=p.updated_at,
    )


async def list_progress(db, user, page, size):
    rows = await repo.progress_list(db, user.id, page, size)
    total = await repo.progress_total(db, user.id)
    return dict(items=[output(p, c) for p, c in rows], total=total, page=page, page_size=size)


async def save(db, user, book_id, body):
    # Serialize all progress writes for this account, including first insert.
    await repo.lock_user(db, user.id)
    book = await catalog.book(db, book_id)
    chapter = await catalog.chapter_by_id(db, body.chapter_id)
    if not book or not chapter or chapter.book_id != book_id:
        raise DomainError(404, "CHAPTER_NOT_FOUND", "Chương không thuộc truyện này.")
    if book.version != body.version:
        raise DomainError(409, "CONTENT_CHANGED", "Dữ liệu truyện đã thay đổi.")
    if body.location_kind == "ratio" and body.location_value > 1:
        raise DomainError(422, "INVALID_LOCATION", "Tỷ lệ phải từ 0 đến 1.")
    row = await repo.progress(db, user.id, book_id)
    if body.expected_revision != (row.revision if row else 0):
        raise DomainError(409, "PROGRESS_CONFLICT", "Thiết bị khác đã cập nhật. Hãy đồng bộ lại.")
    if not row:
        row = Progress(user_id=user.id, book_id=book_id, ratio=0, pixel=0, revision=0)
        await repo.stage(db, row)
    if row.chapter_id != body.chapter_id or row.version != body.version:
        row.ratio = 0
        row.pixel = 0
    row.chapter_id = body.chapter_id
    row.version = body.version
    row.location_kind = body.location_kind
    if body.location_kind == "ratio":
        row.ratio = body.location_value
        row.pixel = 0
    else:
        row.pixel = body.location_value
        row.ratio = 0
    row.revision += 1
    row.updated_at = datetime.now(UTC)
    try:
        await repo.flush(db)
    except IntegrityError:
        raise DomainError(409, "PROGRESS_CONFLICT", "Hãy đồng bộ lại.") from None
    return output(row, chapter)
