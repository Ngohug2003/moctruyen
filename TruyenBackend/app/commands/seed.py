"""Import validated, versioned web chunks; no source ID recalculation."""

import asyncio
import json
from pathlib import Path

from sqlalchemy import func, select

from app.constants.database import Session, engine
from app.models.entities import Book, Chapter


async def seed(root):
    manifest = json.loads((root / "index.json").read_text(encoding="utf-8"))
    for book in manifest:
        folder = root.parent / book["basePath"]
        # Validate every chunk before opening the write transaction.
        seen = set()
        count = 0
        for page, name in enumerate(book["chunks"]):
            toc = json.loads((folder / f"toc-{page}.json").read_text(encoding="utf-8"))
            content = {
                c["id"]: c["content"]
                for c in json.loads((folder / name).read_text(encoding="utf-8"))
            }
            for c in toc:
                if (
                    c["position"] != count
                    or c["id"] in seen
                    or not content.get(c["id"], "").strip()
                ):
                    raise ValueError("Invalid chapter data")
                seen.add(c["id"])
                count += 1
        if count != book["total"]:
            raise ValueError("Chapter count mismatch")
        async with Session.begin() as db:
            previous = await db.get(Book, book["id"])
            if previous:
                if previous.version != book["version"]:
                    raise ValueError("Existing revision differs; explicit revision import required")
                actual = await db.scalar(
                    select(func.count()).select_from(Chapter).where(Chapter.book_id == book["id"])
                )
                if actual != count:
                    raise ValueError("Existing import incomplete")
                print(f"Already seeded: {book['title']} ({count})")
                continue
            db.add(Book(id=book["id"], title=book["title"], total=count, version=book["version"]))
            await db.flush()
            for page, name in enumerate(book["chunks"]):
                toc = json.loads((folder / f"toc-{page}.json").read_text(encoding="utf-8"))
                content = {
                    c["id"]: c["content"]
                    for c in json.loads((folder / name).read_text(encoding="utf-8"))
                }
                db.add_all(
                    [Chapter(**c, book_id=book["id"], content=content[c["id"]]) for c in toc]
                )
                await db.flush()
        print(f"Seeded: {book['title']} ({count})")
    await engine.dispose()


if __name__ == "__main__":
    import sys

    asyncio.run(
        seed(
            Path(sys.argv[1])
            if len(sys.argv) > 1
            else Path(__file__).resolve().parents[3] / "TruyenWeb/public/books"
        )
    )
