"""Seed Đế Bá (faec571705be16f3) chapters into PostgreSQL if not already present."""

import asyncio
import gzip
import os
import shutil
import sqlite3
import tempfile
import time
from pathlib import Path

from sqlalchemy import delete, func, select

from app.constants.database import Session, engine
from app.models.entities import Book, Chapter

BOOK_ID = "faec571705be16f3"
BOOK_TITLE = "Đế Bá"
BOOK_TOTAL = 6899
BOOK_VERSION = "b40a476ab8003bf9bcc3"
BATCH_SIZE = 500


async def seed():
    data_dir = Path(__file__).resolve().parents[2] / "data"
    gz_path = data_dir / "deba_chapters.db.gz"

    if not gz_path.exists():
        print(f"Notice: {gz_path} not found. Skipping deba seeding.")
        return

    async with Session.begin() as db:
        existing_book = await db.get(Book, BOOK_ID)
        if not existing_book:
            db.add(Book(id=BOOK_ID, title=BOOK_TITLE, total=BOOK_TOTAL, version=BOOK_VERSION))
            await db.flush()
        elif existing_book.total != BOOK_TOTAL:
            existing_book.total = BOOK_TOTAL
            existing_book.title = BOOK_TITLE

        count = await db.scalar(
            select(func.count()).select_from(Chapter).where(Chapter.book_id == BOOK_ID)
        )
        if count and count >= BOOK_TOTAL:
            print(f"Đế Bá already fully seeded ({count} chapters). Skipping.")
            return

        print(f"Seeding Đế Bá: currently {count or 0}/{BOOK_TOTAL} chapters in DB...")
        t0 = time.time()

        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_file:
            tmp_path = Path(tmp_file.name)

        try:
            with gzip.open(gz_path, "rb") as f_in:
                with open(tmp_path, "wb") as f_out:
                    shutil.copyfileobj(f_in, f_out)

            sqlite_conn = sqlite3.connect(tmp_path)
            rows = sqlite_conn.cursor().execute(
                "SELECT id, position, number, title, content FROM chapters ORDER BY position"
            ).fetchall()
            sqlite_conn.close()

            print(f"Extracted {len(rows)} chapters from archive in {time.time() - t0:.2f}s. Inserting into PostgreSQL...")

            await db.execute(delete(Chapter).where(Chapter.book_id == BOOK_ID))
            await db.flush()

            for i in range(0, len(rows), BATCH_SIZE):
                batch = rows[i : i + BATCH_SIZE]
                db.add_all(
                    [
                        Chapter(
                            id=r[0],
                            book_id=BOOK_ID,
                            position=r[1],
                            number=r[2],
                            title=r[3],
                            content=r[4],
                        )
                        for r in batch
                    ]
                )
                await db.flush()

            print(f"Successfully seeded {len(rows)} chapters for '{BOOK_TITLE}' in {time.time() - t0:.2f}s!")
        finally:
            if tmp_path.exists():
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
