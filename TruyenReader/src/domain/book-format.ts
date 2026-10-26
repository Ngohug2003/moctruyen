// Shared by the Node build step and the mobile JSON importer.
export type InputChapter = {
  ten_truyen: string;
  so_chuong: number;
  ten_chuong: string;
  noi_dung: string;
  url?: string;
};
export type NormalizedChapter = {
  id: string;
  position: number;
  number: number;
  title: string;
  content: string;
  url: string;
  searchTitle: string;
};
export type NormalizedBook = {
  id: string;
  title: string;
  chapters: NormalizedChapter[];
  source: string;
  skippedDuplicates: number;
};

export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

// Deterministic identifier, not used for security or encryption.
export function stableId(value: string): string {
  let a = 0x811c9dc5,
    b = 0x9e3779b9;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 0x01000193);
    b = Math.imul(b ^ value.charCodeAt(i), 0x85ebca6b);
  }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}

export function normalizeBook(input: unknown): NormalizedBook {
  if (!Array.isArray(input) || input.length === 0)
    throw new Error(
      'JSON cần là danh sách chương không rỗng, đúng định dạng truyen.json của tool.',
    );
  let title = '';
  const seen = new Map<string, string>();
  const chapters: NormalizedChapter[] = [];
  const ids = new Set<string>();
  let skippedDuplicates = 0;
  for (let i = 0; i < input.length; i++) {
    const raw = input[i];
    const label = `Mục ${i + 1}`;
    if (!raw || typeof raw !== 'object') throw new Error(`${label}: dữ liệu chương không hợp lệ.`);
    const r = raw as Record<string, unknown>;
    for (const field of ['ten_truyen', 'ten_chuong', 'noi_dung']) {
      if (typeof r[field] !== 'string' || !r[field].trim())
        throw new Error(`${label}: thiếu hoặc rỗng trường ${field}.`);
    }
    if (!Number.isSafeInteger(r.so_chuong) || Number(r.so_chuong) < 0)
      throw new Error(`${label}: so_chuong phải là số nguyên không âm.`);
    const name = (r.ten_truyen as string).trim();
    if (title && name !== title)
      throw new Error(
        `${label}: JSON chứa nhiều tên truyện. Hãy nhập mỗi truyện bằng một file riêng.`,
      );
    title = name;
    const chapterTitle = (r.ten_chuong as string).trim();
    const content = (r.noi_dung as string).replace(/\r\n?/g, '\n').trim();
    const url = typeof r.url === 'string' ? r.url.trim() : '';
    const identity = url || `${r.so_chuong}\u001f${chapterTitle}\u001f${content}`;
    if (seen.has(identity)) {
      if (seen.get(identity) !== content)
        throw new Error(`${label}: URL trùng nhưng nội dung khác nhau; cần kiểm tra file nguồn.`);
      skippedDuplicates++;
      continue;
    }
    seen.set(identity, content);
    const id = stableId(identity);
    if (ids.has(id)) throw new Error(`${label}: mã chương bị trùng; kiểm tra dữ liệu nguồn.`);
    ids.add(id);
    chapters.push({
      id,
      position: chapters.length,
      number: Number(r.so_chuong),
      title: chapterTitle,
      content,
      url,
      searchTitle: fold(chapterTitle),
    });
  }
  return {
    id: stableId(fold(title)),
    title,
    chapters,
    source: chapters.find((c) => c.url)?.url ?? '',
    skippedDuplicates,
  };
}

export function parseBookText(text: string): NormalizedBook {
  let input: unknown;
  try {
    input = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(
      'Không đọc được JSON. Hãy chờ tool tải xong rồi dùng file truyen.json, không dùng bao_cao.json.',
    );
  }
  return normalizeBook(input);
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, total INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT NOT NULL, book_id TEXT NOT NULL, position INTEGER NOT NULL,
  number INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '', search_title TEXT NOT NULL,
  PRIMARY KEY(book_id, id), UNIQUE(book_id, position)
);
CREATE INDEX IF NOT EXISTS chapters_order ON chapters(book_id, position);
CREATE INDEX IF NOT EXISTS chapters_number ON chapters(book_id, number, position);
CREATE TABLE IF NOT EXISTS progress (
  book_id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL, offset REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookmarks (
  book_id TEXT NOT NULL, chapter_id TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(book_id, chapter_id)
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS seed_imports (version TEXT PRIMARY KEY);
`;

export const APPLY_BUNDLED_BOOK_SQL = `
DELETE FROM chapters WHERE book_id IN (SELECT id FROM bundled.books);
INSERT OR REPLACE INTO books SELECT * FROM bundled.books;
INSERT INTO chapters SELECT * FROM bundled.chapters;
DELETE FROM bookmarks WHERE NOT EXISTS (SELECT 1 FROM chapters c WHERE c.book_id=bookmarks.book_id AND c.id=bookmarks.chapter_id);
`;
