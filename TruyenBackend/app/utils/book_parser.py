import json
import re
import struct
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.utils.errors import DomainError

CHAPTER_PATTERN = re.compile(
    r"^\s*(?:(?:Quyển\s+\d+[\s:]+)?(?:Thứ\s+(\d+)\s+chương|Chương\s+(\d+)|Đệ\s+(\d+)\s+chương|Hồi\s+(\d+))[:\s\.-]*(.*)|(?:Chương\s+(\d+)))",
    re.IGNORECASE,
)


def stable_id(value: str) -> str:
    """Deterministic 16-hex hash matching JavaScript charCodeAt & 32-bit math."""
    raw = value.encode("utf-16-le")
    units = struct.unpack("<" + "H" * (len(raw) // 2), raw)
    a, b = 0x811C9DC5, 0x9E3779B9
    for code in units:
        a = ((a ^ code) * 0x01000193) & 0xFFFFFFFF
        b = ((b ^ code) * 0x85EBCA6B) & 0xFFFFFFFF
    return f"{a:08x}{b:08x}"


def fold(value: str) -> str:
    """Normalize Vietnamese diacritics for deterministic IDs and searching."""
    nfd = unicodedata.normalize("NFD", value)
    no_diacritics = re.sub(r"[\u0300-\u036f]", "", nfd)
    return no_diacritics.replace("đ", "d").replace("Đ", "D").lower()


@dataclass
class ParsedChapter:
    id: str
    position: int
    number: int
    title: str
    content: str


@dataclass
class ParsedBook:
    id: str
    title: str
    version: str
    chapters: list[ParsedChapter]


def clean_title_from_filename(filename: str) -> str:
    base = Path(filename).stem
    # Remove common extra brackets, e.g. "Ten truyen (ban chinh...) ~ Thieu 2224"
    cleaned = re.split(r"[\(\[\~]", base, maxsplit=1)[0].strip()
    return cleaned if cleaned else base


def parse_txt(text: str, filename: str = "", custom_title: str | None = None) -> ParsedBook:
    text = text.replace("\ufeff", "").replace("\r\n", "\n").replace("\r", "\n")
    if not text.strip():
        raise DomainError(400, "EMPTY_FILE", "File truyện rỗng.")

    lines = text.split("\n")
    preamble: list[str] = []
    raw_chapters: list[tuple[int, str, list[str]]] = []
    current_title: str | None = None
    current_num: int = 0
    current_body: list[str] = []

    for line in lines:
        stripped = line.strip()
        match = CHAPTER_PATTERN.match(stripped)
        if match:
            if current_title is not None:
                raw_chapters.append((current_num, current_title, current_body))
            current_title = stripped
            num_str = (
                match.group(1)
                or match.group(2)
                or match.group(3)
                or match.group(4)
                or match.group(5)
                or match.group(6)
            )
            current_num = int(num_str) if num_str and num_str.isdigit() else (len(raw_chapters) + 1)
            current_body = []
        else:
            if current_title is None:
                if stripped:
                    preamble.append(stripped)
            else:
                current_body.append(line)

    if current_title is not None:
        raw_chapters.append((current_num, current_title, current_body))

    if not raw_chapters:
        raise DomainError(
            400,
            "NO_CHAPTERS_FOUND",
            "Không nhận diện được chương nào trong file. Đảm bảo các chương bắt đầu bằng 'Thứ X chương', 'Chương X', hoặc 'Đệ X chương'.",
        )

    # Determine book title
    if custom_title and custom_title.strip():
        title = custom_title.strip()
    elif filename:
        title = clean_title_from_filename(filename)
    elif preamble:
        title = preamble[0]
    else:
        title = "Truyện không tên"

    book_id = stable_id(fold(title))
    version = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

    chapters: list[ParsedChapter] = []
    seen_ids: set[str] = set()

    for pos, (c_num, c_title, c_body_lines) in enumerate(raw_chapters):
        c_content = "\n".join(c_body_lines).strip()
        identity = f"{book_id}\u001f{c_num}\u001f{c_title}\u001f{c_content}"
        c_id = stable_id(identity)
        if c_id in seen_ids:
            # Fallback identity with position to ensure chapter ID uniqueness in case of duplicate content
            c_id = stable_id(f"{identity}\u001f{pos}")
        seen_ids.add(c_id)

        chapters.append(
            ParsedChapter(
                id=c_id,
                position=pos,
                number=c_num,
                title=c_title,
                content=c_content,
            )
        )

    return ParsedBook(id=book_id, title=title, version=version, chapters=chapters)


def parse_json(text: str, custom_title: str | None = None) -> ParsedBook:
    try:
        data = json.loads(text.replace("\ufeff", ""))
    except Exception as exc:
        raise DomainError(400, "INVALID_JSON", f"File JSON không hợp lệ: {exc}") from exc

    if not isinstance(data, list) or not data:
        raise DomainError(400, "INVALID_JSON_FORMAT", "File JSON phải là danh sách các chương.")

    first_item = data[0]
    if not isinstance(first_item, dict):
        raise DomainError(400, "INVALID_JSON_FORMAT", "Dữ liệu chương trong JSON không hợp lệ.")

    detected_title = first_item.get("ten_truyen", "")
    title = (custom_title or detected_title or "Truyện không tên").strip()
    book_id = stable_id(fold(title))
    version = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

    chapters: list[ParsedChapter] = []
    seen_ids: set[str] = set()

    for pos, item in enumerate(data):
        c_num = int(item.get("so_chuong", pos + 1))
        c_title = str(item.get("ten_chuong", f"Chương {c_num}")).strip()
        c_content = str(item.get("noi_dung", "")).replace("\r\n", "\n").replace("\r", "\n").strip()
        url = str(item.get("url", "")).strip()

        identity = f"{book_id}\u001f{url}" if url else f"{book_id}\u001f{c_num}\u001f{c_title}\u001f{c_content}"
        c_id = stable_id(identity)
        if c_id in seen_ids:
            c_id = stable_id(f"{identity}\u001f{pos}")
        seen_ids.add(c_id)

        chapters.append(
            ParsedChapter(
                id=c_id,
                position=pos,
                number=c_num,
                title=c_title,
                content=c_content,
            )
        )

    return ParsedBook(id=book_id, title=title, version=version, chapters=chapters)


def export_web_chunks(parsed: ParsedBook, web_books_dir: Path, page_size: int = 50) -> bool:
    """Exports static chunks for TruyenWeb if the public/books directory is available."""
    try:
        if not web_books_dir.exists():
            return False

        book_folder = web_books_dir / parsed.id / parsed.version
        book_folder.mkdir(parents=True, exist_ok=True)

        page_count = (len(parsed.chapters) + page_size - 1) // page_size
        chunk_names: list[str] = []

        # Export TOC chunks and content chunks
        for page_idx in range(page_count):
            start = page_idx * page_size
            end = start + page_size
            batch = parsed.chapters[start:end]

            toc_data = [
                {"id": c.id, "position": c.position, "number": c.number, "title": c.title}
                for c in batch
            ]
            content_data = [{"id": c.id, "content": c.content} for c in batch]

            toc_file = book_folder / f"toc-{page_idx}.json"
            content_name = f"content-{page_idx}.json"
            content_file = book_folder / content_name

            toc_file.write_text(json.dumps(toc_data, ensure_ascii=False), encoding="utf-8")
            content_file.write_text(json.dumps(content_data, ensure_ascii=False), encoding="utf-8")
            chunk_names.append(content_name)

        # Export search.json
        search_data = [
            {"id": c.id, "position": c.position, "number": c.number, "title": c.title}
            for c in parsed.chapters
        ]
        (book_folder / "search.json").write_text(
            json.dumps(search_data, ensure_ascii=False), encoding="utf-8"
        )

        # Update index.json
        index_file = web_books_dir / "index.json"
        index_data: list[dict] = []
        if index_file.exists():
            try:
                index_data = json.loads(index_file.read_text(encoding="utf-8"))
            except Exception:
                index_data = []

        manifest_entry = {
            "id": parsed.id,
            "title": parsed.title,
            "total": len(parsed.chapters),
            "version": parsed.version,
            "basePath": f"books/{parsed.id}/{parsed.version}",
            "pageSize": page_size,
            "pageCount": page_count,
            "chunks": chunk_names,
        }

        # Replace or append in index.json
        existing_idx = next((i for i, b in enumerate(index_data) if b.get("id") == parsed.id), -1)
        if existing_idx >= 0:
            index_data[existing_idx] = manifest_entry
        else:
            index_data.append(manifest_entry)

        index_file.write_text(json.dumps(index_data, ensure_ascii=False), encoding="utf-8")
        return True
    except Exception:
        return False
