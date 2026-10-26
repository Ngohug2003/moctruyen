from sqlalchemy import delete, func, select

from app.models.entities import Book, Chapter


async def books(db, page, size):
    total = await db.scalar(select(func.count()).select_from(Book))
    rows = (
        await db.scalars(select(Book).order_by(Book.id).offset((page - 1) * size).limit(size))
    ).all()
    return rows, total


async def chapters(db, book_id, page, size):
    total = await db.scalar(
        select(func.count()).select_from(Chapter).where(Chapter.book_id == book_id)
    )
    rows = (
        (
            await db.execute(
                select(Chapter.id, Chapter.position, Chapter.number, Chapter.title)
                .where(Chapter.book_id == book_id)
                .order_by(Chapter.position, Chapter.id)
                .offset((page - 1) * size)
                .limit(size)
            )
        )
        .mappings()
        .all()
    )
    return rows, total


async def chapter(db, book_id, position):
    return await db.scalar(
        select(Chapter).where(Chapter.book_id == book_id, Chapter.position == position)
    )


async def book(db, book_id):
    return await db.get(Book, book_id)


async def chapter_by_id(db, chapter_id):
    return await db.get(Chapter, chapter_id)


async def save_book_and_chapters(
    db, book_entity: Book, chapter_entities: list[Chapter], overwrite: bool = False
) -> tuple[Book | None, bool]:
    existing = await db.get(Book, book_entity.id)
    if existing:
        if not overwrite:
            return None, False
        await db.execute(delete(Chapter).where(Chapter.book_id == book_entity.id))
        existing.title = book_entity.title
        existing.total = book_entity.total
        existing.version = book_entity.version
        target_book = existing
    else:
        db.add(book_entity)
        target_book = book_entity

    await db.flush()

    batch_size = 100
    for i in range(0, len(chapter_entities), batch_size):
        batch = chapter_entities[i : i + batch_size]
        db.add_all(batch)
        await db.flush()

    return target_book, True
