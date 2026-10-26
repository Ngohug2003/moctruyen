"""Explicit idempotent import of the maintained cultivation dataset."""

import asyncio
from pathlib import Path

from app.constants.database import Session, engine
from app.models.entities import Book
from app.repositories import catalog
from app.schemas.responses.cultivation import CultivationOut
from app.services.cultivation import import_guide


async def main():
    root = Path(__file__).resolve().parents[2] / "data/cultivation"
    try:
        for path in sorted(root.glob("*.json")):
            body = CultivationOut.model_validate_json(path.read_text(encoding="utf-8"))
            async with Session.begin() as db:
                if not await catalog.book(db, body.book_id):
                    if body.book_id == "faec571705be16f3":
                        db.add(
                            Book(
                                id="faec571705be16f3",
                                title="Đế Bá",
                                total=6899,
                                version="b40a476ab8003bf9bcc3",
                            )
                        )
                        await db.flush()
                try:
                    changed = await import_guide(db, body)
                    print(
                        f"Cultivation {body.book_id}: {len(body.systems)} systems ({'imported' if changed else 'unchanged'})"
                    )
                except Exception as e:
                    print(f"Skipping guide {body.book_id}: {e}")
    except Exception as e:
        print(f"Cultivation import notice: {e}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
