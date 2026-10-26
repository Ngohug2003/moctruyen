"""Clean only an explicitly named account created by the browser test."""

import asyncio
import sys

from sqlalchemy import delete

from app.constants.database import Session, engine
from app.models.entities import User


async def main():
    email = sys.argv[1]
    if not email.startswith("qa-") or not email.endswith("@example.com"):
        raise ValueError("Only a named browser-test account may be cleaned")
    async with Session.begin() as db:
        await db.execute(delete(User).where(User.email == email))
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
