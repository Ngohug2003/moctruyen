"""CLI command to convert and import a story file (.txt or .json) into PostgreSQL and TruyenWeb."""

import argparse
import asyncio
import sys
from pathlib import Path

from app.constants.database import Session, engine
from app.services import catalog as catalog_service


async def run_import(
    filepath: Path,
    custom_title: str | None = None,
    overwrite: bool = False,
    export_chunks: bool = True,
):
    if not filepath.exists():
        print(f"Error: File '{filepath}' does not exist.", file=sys.stderr)
        sys.exit(1)

    print(f"Reading file: {filepath} ({filepath.stat().st_size / (1024 * 1024):.2f} MB)...")
    content = filepath.read_bytes()

    async with Session.begin() as db:
        result = await catalog_service.upload_book(
            db=db,
            filename=filepath.name,
            content=content,
            custom_title=custom_title,
            overwrite=overwrite,
            export_chunks=export_chunks,
        )

    print("=" * 60)
    print("IMPORT COMPLETED SUCCESSFULLY!")
    print(f"- ID:        {result.id}")
    print(f"- Title:     {result.title}")
    print(f"- Total:     {result.total} chapters")
    print(f"- Version:   {result.version}")
    print(f"- Duration:  {result.duration_seconds}s")
    print(f"- Web Chunks: {'Exported' if result.exported_chunks else 'Skipped/Unavailable'}")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Convert and import novel into database.")
    parser.add_argument("file", type=Path, help="Path to .txt or .json novel file")
    parser.add_argument("--title", type=str, default=None, help="Custom novel title")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite if book already exists")
    parser.add_argument(
        "--no-chunks", action="store_true", help="Do not export static chunks for TruyenWeb"
    )

    args = parser.parse_args()

    async def _runner():
        try:
            await run_import(
                filepath=args.file,
                custom_title=args.title,
                overwrite=args.overwrite,
                export_chunks=not args.no_chunks,
            )
        finally:
            await engine.dispose()

    asyncio.run(_runner())


if __name__ == "__main__":
    main()
