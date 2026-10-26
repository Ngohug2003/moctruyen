import { readLocalFirst } from '../domain/read-source';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import meta from '../../assets/book-meta.json';
import { cloud } from '../api/cloud';
import { APPLY_BUNDLED_BOOK_SQL, SCHEMA, fold, type NormalizedBook } from '../domain/book-format';
import { CHAPTER_PAGE_SIZE, chapterPageQuery } from '../domain/chapter-query';
import { REMOVE_LEGACY_SAMPLE_SQL } from '../domain/library-cleanup';
import { getBundledContent } from './bundled-content';

export type Book = {
  id: string;
  title: string;
  total: number;
  source: string;
  updated_at: string;
  chapter_id: string | null;
  offset: number | null;
  chapter_title: string | null;
  position: number | null;
};
export type ChapterMeta = {
  id: string;
  position: number;
  number: number;
  title: string;
  marked: number;
};
export type Chapter = ChapterMeta & { content: string; url: string; book_id: string };
export type ReaderSettings = {
  theme: 'paper' | 'sepia' | 'night';
  fontSize: number;
  lineHeight: number;
  font: 'serif' | 'sans';
  keepAwake: boolean;
};
export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'paper',
  fontSize: 21,
  lineHeight: 1.8,
  font: 'serif',
  keepAwake: true,
};
let library: SQLiteDatabase;

export async function initialize(seed: SQLiteDatabase) {
  library = await openDatabaseAsync('moc-library.db');
  await library.execAsync('PRAGMA journal_mode = WAL; ' + SCHEMA);
  await library.execAsync(
    'CREATE TABLE IF NOT EXISTS account_progress (user_id TEXT NOT NULL, book_id TEXT NOT NULL, chapter_id TEXT NOT NULL, offset REAL NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,book_id))',
  );
  await cloud.init();
  cloud.receive(applyRemote);
  void cloud.sync();
  void syncRemoteCatalog();
  const imported = await library.getFirstAsync(
    'SELECT version FROM seed_imports WHERE version=?',
    `chunks-v1:${meta.hash}`,
  );
  if (!imported) {
    await library.runAsync('ATTACH DATABASE ? AS bundled', seed.databasePath);
    try {
      await library.withTransactionAsync(async () => {
        const tx = library;
        await tx.execAsync(APPLY_BUNDLED_BOOK_SQL);
        await tx.runAsync('INSERT INTO seed_imports(version) VALUES (?)', `chunks-v1:${meta.hash}`);
      });
    } finally {
      await library.execAsync('DETACH DATABASE bundled');
    }
  }
  await library.withTransactionAsync(() => library.execAsync(REMOVE_LEGACY_SAMPLE_SQL));
}

export async function syncRemoteCatalog(): Promise<void> {
  try {
    const remote = await cloud.request<{
      items: Array<{ id: string; title: string; total: number; version: string }>;
      total: number;
    }>('/public/books?page_size=100', undefined, 'GET', 4000);
    if (remote && Array.isArray(remote.items)) {
      await library.withTransactionAsync(async () => {
        for (const b of remote.items) {
          const existing = await library.getFirstAsync<{ id: string; total: number; title: string }>(
            'SELECT id, total, title FROM books WHERE id=?',
            b.id,
          );
          if (!existing) {
            await library.runAsync(
              'INSERT INTO books(id,title,total,source,updated_at) VALUES (?,?,?,?,?)',
              b.id,
              b.title,
              b.total,
              'cloud',
              new Date().toISOString(),
            );
          } else if (existing.total !== b.total || existing.title !== b.title) {
            await library.runAsync(
              'UPDATE books SET title=?, total=?, updated_at=? WHERE id=?',
              b.title,
              b.total,
              new Date().toISOString(),
              b.id,
            );
          }
        }
      });
    }
  } catch (err) {
    console.warn('syncRemoteCatalog offline or failed:', err);
  }
}

async function applyRemote(rows: import('../api/client').RemoteProgress[]) {
  const userId = cloud.user?.id;
  if (!userId) return;
  for (const row of rows) {
    await library.runAsync(
      'INSERT OR REPLACE INTO account_progress(user_id,book_id,chapter_id,offset,updated_at) VALUES(?,?,?,?,?)',
      userId,
      row.book_id,
      row.chapter_id,
      row.location_kind === 'pixel' ? row.pixel : 0,
      row.updated_at,
    );
  }
}
export async function listBooks(): Promise<Book[]> {
  if (cloud.user)
    return library.getAllAsync<Book>(
      `SELECT b.*,p.chapter_id,p.offset,c.title AS chapter_title,c.position FROM books b LEFT JOIN account_progress p ON p.book_id=b.id AND p.user_id=? LEFT JOIN chapters c ON c.book_id=b.id AND c.id=p.chapter_id ORDER BY COALESCE(p.updated_at,b.updated_at) DESC`,
      cloud.user.id,
    );
  return library.getAllAsync<Book>(`SELECT b.*,p.chapter_id,p.offset,c.title AS chapter_title,c.position
    FROM books b LEFT JOIN progress p ON p.book_id=b.id
    LEFT JOIN chapters c ON c.book_id=b.id AND c.id=p.chapter_id
    ORDER BY COALESCE(p.updated_at,b.updated_at) DESC`);
}
export async function getChapterPage(
  bookId: string,
  query = '',
  markedOnly = false,
  page = 0,
): Promise<{ rows: ChapterMeta[]; total: number }> {
  const sql = chapterPageQuery(bookId, query, markedOnly, page);
  const count = await library.getFirstAsync<{ total: number }>(sql.countSQL, ...sql.countArgs);
  let rows = await library.getAllAsync<ChapterMeta>(sql.rowsSQL, ...sql.rowArgs);
  let total = count?.total || 0;

  if (markedOnly || query.trim()) {
    return { rows, total };
  }

  // If local SQLite does not have this page's chapters, fetch from cloud API
  if (rows.length === 0) {
    try {
      const remote = await cloud.request<{
        items: Array<{ id: string; position: number; number: number; title: string }>;
        total: number;
      }>(
        `/public/books/${bookId}/chapters?page=${page + 1}&page_size=${CHAPTER_PAGE_SIZE}`,
        undefined,
        'GET',
        5000,
      );
      if (remote && Array.isArray(remote.items) && remote.items.length > 0) {
        await library.withTransactionAsync(async () => {
          for (const item of remote.items) {
            await library.runAsync(
              'INSERT OR IGNORE INTO chapters(id,book_id,position,number,title,content,url,search_title) VALUES (?,?,?,?,?,?,?,?)',
              item.id,
              bookId,
              item.position,
              item.number,
              item.title,
              '',
              '',
              fold(item.title),
            );
          }
        });
        total = remote.total;
        rows = await library.getAllAsync<ChapterMeta>(sql.rowsSQL, ...sql.rowArgs);
      }
    } catch (err) {
      console.warn('getChapterPage remote error:', err);
    }
  }

  return { rows, total };
}
export { CHAPTER_PAGE_SIZE };
export async function getChapterAt(bookId: string, position: number): Promise<ChapterMeta | null> {
  const local = await library.getFirstAsync<ChapterMeta>(
    'SELECT id,position,number,title,0 AS marked FROM chapters WHERE book_id=? AND position=?',
    bookId,
    position,
  );
  if (local) return local;

  try {
    const remote = await cloud.request<{
      id: string;
      position: number;
      number: number;
      title: string;
      content?: string;
    }>(`/public/books/${bookId}/chapters/${position}`, undefined, 'GET', 5000);
    if (remote && remote.id) {
      await library.runAsync(
        'INSERT OR REPLACE INTO chapters(id,book_id,position,number,title,content,url,search_title) VALUES (?,?,?,?,?,?,?,?)',
        remote.id,
        bookId,
        remote.position,
        remote.number,
        remote.title,
        remote.content || '',
        '',
        fold(remote.title),
      );
      return {
        id: remote.id,
        position: remote.position,
        number: remote.number,
        title: remote.title,
        marked: 0,
      };
    }
  } catch (err) {
    console.warn('getChapterAt remote error:', err);
  }
  return null;
}
export async function getNeighbor(
  bookId: string,
  position: number,
  direction: -1 | 1,
): Promise<ChapterMeta | null> {
  const nextPos = position + direction;
  if (nextPos < 0) return null;
  const book = await library.getFirstAsync<{ total: number }>(
    'SELECT total FROM books WHERE id=?',
    bookId,
  );
  if (book && nextPos >= book.total) return null;

  return getChapterAt(bookId, nextPos);
}
export async function getChapter(bookId: string, id: string): Promise<Chapter | null> {
  const row = await library.getFirstAsync<Chapter>(
    `SELECT c.*,CASE WHEN m.chapter_id IS NULL THEN 0 ELSE 1 END AS marked
    FROM chapters c LEFT JOIN bookmarks m ON m.book_id=c.book_id AND m.chapter_id=c.id WHERE c.book_id=? AND c.id=?`,
    bookId,
    id,
  );
  if (row && !row.content) {
    row.content = await readLocalFirst(
      () => getBundledContent(bookId, row.position, row.id),
      async () => {
        const remote = await cloud.request<{ id: string; content: string }>(
          `/public/books/${bookId}/chapters/${row.position}`,
          undefined,
          'GET',
          5000,
        );
        if (remote.id !== row.id || !remote.content.trim())
          throw new Error('Nội dung trên máy chủ không khớp chương đang đọc.');
        await library.runAsync(
          'UPDATE chapters SET content=? WHERE book_id=? AND id=?',
          remote.content,
          bookId,
          id,
        );
        return remote.content;
      },
    );
  }
  return row;
}
export async function saveProgress(bookId: string, chapterId: string, offset: number) {
  if (cloud.user) {
    await library.runAsync(
      'INSERT OR REPLACE INTO account_progress(user_id,book_id,chapter_id,offset,updated_at) VALUES(?,?,?,?,?)',
      cloud.user.id,
      bookId,
      chapterId,
      Math.max(0, offset),
      new Date().toISOString(),
    );
    await cloud.queue(bookId, {
      chapter_id: chapterId,
      version: bookId === meta.bookId ? meta.hash : 'v1',
      location_kind: 'pixel',
      location_value: Math.max(0, offset),
    });
    return;
  }
  await library.runAsync(
    'INSERT OR REPLACE INTO progress(book_id,chapter_id,offset,updated_at) VALUES (?,?,?,?)',
    bookId,
    chapterId,
    Math.max(0, offset),
    new Date().toISOString(),
  );
}
export async function toggleBookmark(bookId: string, chapterId: string): Promise<boolean> {
  const existing = await library.getFirstAsync(
    'SELECT 1 FROM bookmarks WHERE book_id=? AND chapter_id=?',
    bookId,
    chapterId,
  );
  if (existing)
    await library.runAsync(
      'DELETE FROM bookmarks WHERE book_id=? AND chapter_id=?',
      bookId,
      chapterId,
    );
  else
    await library.runAsync(
      'INSERT INTO bookmarks VALUES (?,?,?)',
      bookId,
      chapterId,
      new Date().toISOString(),
    );
  return !existing;
}
export async function loadSettings(): Promise<ReaderSettings> {
  const row = await library.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key=?',
    'reader',
  );
  if (!row) return DEFAULT_SETTINGS;
  try {
    const r = JSON.parse(row.value);
    return {
      theme: ['paper', 'sepia', 'night'].includes(r.theme) ? r.theme : 'paper',
      fontSize: Math.min(32, Math.max(15, Number(r.fontSize) || 21)),
      lineHeight: Math.min(2.2, Math.max(1.4, Number(r.lineHeight) || 1.8)),
      font: r.font === 'sans' ? 'sans' : 'serif',
      keepAwake: r.keepAwake !== false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export async function saveSettings(value: ReaderSettings) {
  await library.runAsync(
    'INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)',
    'reader',
    JSON.stringify(value),
  );
}
export async function importBook(book: NormalizedBook, onProgress: (done: number) => void) {
  await library.withTransactionAsync(async () => {
    const tx = library;
    await tx.runAsync('DELETE FROM chapters WHERE book_id=?', book.id);
    await tx.runAsync(
      'INSERT OR REPLACE INTO books(id,title,total,source,updated_at) VALUES (?,?,?,?,?)',
      book.id,
      book.title,
      book.chapters.length,
      book.source,
      new Date().toISOString(),
    );
    const stmt = await tx.prepareAsync(
      'INSERT INTO chapters(id,book_id,position,number,title,content,url,search_title) VALUES (?,?,?,?,?,?,?,?)',
    );
    try {
      for (let i = 0; i < book.chapters.length; i++) {
        const c = book.chapters[i];
        await stmt.executeAsync(
          c.id,
          book.id,
          c.position,
          c.number,
          c.title,
          c.content,
          c.url,
          c.searchTitle,
        );
        if (i % 100 === 0) {
          onProgress(i + 1);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    } finally {
      await stmt.finalizeAsync();
    }
    await tx.runAsync(
      'DELETE FROM bookmarks WHERE book_id=? AND chapter_id NOT IN (SELECT id FROM chapters WHERE book_id=?)',
      book.id,
      book.id,
    );
  });
}
export type SavedChapter = ChapterMeta & { book_id: string; book_title: string };
export async function listBookmarks(): Promise<SavedChapter[]> {
  return library.getAllAsync<SavedChapter>(`SELECT c.id,c.position,c.number,c.title,1 AS marked,c.book_id,b.title AS book_title
    FROM bookmarks m JOIN chapters c ON c.book_id=m.book_id AND c.id=m.chapter_id JOIN books b ON b.id=m.book_id
    ORDER BY m.created_at DESC`);
}
