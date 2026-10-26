"""Explicit idempotent import of the maintained cultivation dataset."""

import asyncio
from pathlib import Path

from app.constants.database import Session, engine
from app.schemas.responses.cultivation import CultivationOut
from app.services.cultivation import import_guide


async def main():
    root = Path(__file__).resolve().parents[2] / "data/cultivation"
    try:
        for path in sorted(root.glob("*.json")):
            body = CultivationOut.model_validate_json(path.read_text(encoding="utf-8"))
            async with Session.begin() as db:
                changed = await import_guide(db, body)
            print(
                f"Cultivation {body.book_id}: {len(body.systems)} systems ({'imported' if changed else 'unchanged'})"
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
