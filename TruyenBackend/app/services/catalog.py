import time
from pathlib import Path

from app.models.entities import Book, Chapter
from app.repositories import catalog as repo
from app.schemas.responses.outputs import BookPreviewOut, BookUploadOut, ChapterPreview
from app.utils.book_parser import ParsedChapter, export_web_chunks, parse_json, parse_txt
from app.utils.errors import DomainError


async def books(db, page, size):
    rows, total = await repo.books(db, page, size)
    return dict(items=rows, total=total, page=page, page_size=size)


async def chapters(db, book_id, page, size):
    if not await repo.book(db, book_id):
        raise DomainError(404, "BOOK_NOT_FOUND", "Không tìm thấy truyện.")
    rows, total = await repo.chapters(db, book_id, page, size)
    return dict(items=rows, total=total, page=page, page_size=size)


async def chapter(db, book_id, position):
    row = await repo.chapter(db, book_id, position)
    if not row:
        raise DomainError(404, "CHAPTER_NOT_FOUND", "Không tìm thấy chương.")
    return row


async def upload_book(
    db,
    filename: str,
    content: bytes,
    custom_title: str | None = None,
    overwrite: bool = False,
    export_chunks: bool = True,
) -> BookUploadOut:
    t0 = time.monotonic()
    ext = Path(filename).suffix.lower()
    if ext not in {".txt", ".json"}:
        raise DomainError(
            400,
            "UNSUPPORTED_FILE_TYPE",
            f"Định dạng file '{ext}' không được hỗ trợ. Hãy tải lên file .txt hoặc .json.",
        )

    text = content.decode("utf-8-sig", errors="replace")
    if ext == ".txt":
        parsed = parse_txt(text, filename=filename, custom_title=custom_title)
    else:
        parsed = parse_json(text, custom_title=custom_title)

    book = Book(
        id=parsed.id,
        title=parsed.title,
        total=len(parsed.chapters),
        version=parsed.version,
    )
    chapters = [
        Chapter(
            id=c.id,
            book_id=parsed.id,
            position=c.position,
            number=c.number,
            title=c.title,
            content=c.content,
        )
        for c in parsed.chapters
    ]

    saved_book, success = await repo.save_book_and_chapters(db, book, chapters, overwrite=overwrite)
    if not success or not saved_book:
        raise DomainError(
            409,
            "BOOK_ALREADY_EXISTS",
            f"Truyện '{parsed.title}' (ID: {parsed.id}) đã tồn tại trong hệ thống. Bật overwrite nếu muốn cập nhật/ghi đè.",
        )

    chunks_exported = False
    if export_chunks:
        candidates = [
            Path(__file__).resolve().parents[2].parent / "TruyenWeb" / "public" / "books",
            Path("/seed/books"),
        ]
        for dir_path in candidates:
            if dir_path.exists():
                chunks_exported = export_web_chunks(parsed, dir_path)
                if chunks_exported:
                    break

    duration = round(time.monotonic() - t0, 2)
    return BookUploadOut(
        id=parsed.id,
        title=parsed.title,
        total=len(parsed.chapters),
        version=parsed.version,
        duration_seconds=duration,
        exported_chunks=chunks_exported,
        message=f"Đã lưu thành công truyện '{parsed.title}' ({len(parsed.chapters)} chương) trong {duration}s.",
    )


async def preview_book(
    filename: str,
    content: bytes,
    custom_title: str | None = None,
) -> BookPreviewOut:
    t0 = time.monotonic()
    ext = Path(filename).suffix.lower()
    if ext not in {".txt", ".json"}:
        raise DomainError(
            400,
            "UNSUPPORTED_FILE_TYPE",
            f"Định dạng file '{ext}' không được hỗ trợ. Hãy tải lên file .txt hoặc .json.",
        )

    text = content.decode("utf-8-sig", errors="replace")
    if ext == ".txt":
        parsed = parse_txt(text, filename=filename, custom_title=custom_title)
    else:
        parsed = parse_json(text, custom_title=custom_title)

    def to_preview(c: ParsedChapter) -> ChapterPreview:
        excerpt = c.content[:240].strip()
        if len(c.content) > 240:
            excerpt += "…"
        return ChapterPreview(
            position=c.position,
            number=c.number,
            title=c.title,
            excerpt=excerpt,
        )

    first = [to_preview(c) for c in parsed.chapters[:4]]
    last = [to_preview(c) for c in parsed.chapters[-2:]] if len(parsed.chapters) > 4 else []

    duration = round(time.monotonic() - t0, 2)
    return BookPreviewOut(
        id=parsed.id,
        title=parsed.title,
        total=len(parsed.chapters),
        version=parsed.version,
        duration_seconds=duration,
        first_chapters=first,
        last_chapters=last,
    )
