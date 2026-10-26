from sqlalchemy import func, select

from app.models.entities import Chapter, LoginSession, Progress, User


async def by_email(db, email):
    return await db.scalar(select(User).where(User.email == email))


async def add(db, value):
    db.add(value)
    await db.flush()


async def progress_list(db, user_id, page, size):
    return (
        await db.execute(
            select(Progress, Chapter)
            .join(Chapter, Progress.chapter_id == Chapter.id)
            .where(Progress.user_id == user_id)
            .order_by(Progress.book_id)
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()


async def token_session(db, token_hash):
    return await db.get(LoginSession, token_hash)


async def user(db, user_id):
    return await db.get(User, user_id)


async def remove(db, row):
    await db.delete(row)


async def lock_user(db, user_id):
    await db.execute(select(User.id).where(User.id == user_id).with_for_update())


async def progress(db, user_id, book_id):
    return await db.get(Progress, (user_id, book_id), populate_existing=True)


async def progress_total(db, user_id):
    return await db.scalar(
        select(func.count()).select_from(Progress).where(Progress.user_id == user_id)
    )


async def stage(db, row):
    db.add(row)


async def flush(db):
    await db.flush()
