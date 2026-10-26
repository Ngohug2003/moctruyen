import { Platform } from 'react-native';
import { readLocalFirst } from '../domain/read-source';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import meta from '../../assets/book-meta.json';
import debaTocRaw from '../../assets/deba-toc.json';
import { cloud } from '../api/cloud';
import { APPLY_BUNDLED_BOOK_SQL, SCHEMA, fold, type NormalizedBook } from '../domain/book-format';
import { CHAPTER_PAGE_SIZE, chapterPageQuery } from '../domain/chapter-query';
import { REMOVE_LEGACY_SAMPLE_SQL } from '../domain/library-cleanup';
import { getBundledContent } from './bundled-content';

const debaToc = debaTocRaw as Array<{ id: string; position: number; number: number; title: string }>;

export type Book = {
  id: string;
  title: string;
  total: number;
  version?: string;
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

const webBooksMap = new Map<string, Book>();
const webChaptersCache = new Map<string, Chapter>();

function getWebProgress(
  bookId: string,
): { chapter_id: string; offset: number; chapter_title: string; position: number } | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('moc_prog_' + bookId) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveWebProgress(bookId: string, chapterId: string, offset: number) {
  try {
    const chapter = webChaptersCache.get(`${bookId}:${chapterId}`);
    const data = {
      chapter_id: chapterId,
      offset,
      chapter_title: chapter?.title || null,
      position: chapter?.position != null ? chapter.position : 0,
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('moc_prog_' + bookId, JSON.stringify(data));
    }
    const b = webBooksMap.get(bookId);
    if (b) {
      b.chapter_id = chapterId;
      b.offset = offset;
      b.chapter_title = data.chapter_title;
      b.position = data.position;
    }
  } catch {}
}

function isWebMarked(bookId: string, chapterId: string): boolean {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('moc_marks') : null;
    const marks: string[] = raw ? JSON.parse(raw) : [];
    return marks.includes(`${bookId}:${chapterId}`);
  } catch {
    return false;
  }
}

export async function initializeWeb() {
  await cloud.init();
  cloud.receive(applyRemote);
  void cloud.sync();
  if (meta.bookId) {
    const prog = getWebProgress(meta.bookId);
    webBooksMap.set(meta.bookId, {
      id: meta.bookId,
      title: meta.title || 'Đế Bá',
      total: meta.count || debaToc.length,
      source: 'bundled',
      updated_at: new Date().toISOString(),
      chapter_id: prog?.chapter_id || null,
      offset: prog?.offset || null,
      chapter_title: prog?.chapter_title || null,
      position: prog?.position != null ? prog.position : null,
    });
  }
  await syncRemoteCatalog();
}

export async function initialize(seed: SQLiteDatabase) {
  library = await openDatabaseAsync('moc-library.db');
  await library.execAsync('PRAGMA journal_mode = WAL; ' + SCHEMA);
  try {
    await library.execAsync('ALTER TABLE books ADD COLUMN version TEXT DEFAULT ""');
  } catch {}
  await library.execAsync(
    'CREATE TABLE IF NOT EXISTS account_progress (user_id TEXT NOT NULL, book_id TEXT NOT NULL, chapter_id TEXT NOT NULL, offset REAL NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,book_id))',
  );
  await cloud.init();
  cloud.receive(applyRemote);
  void cloud.sync();
  void syncRemoteCatalog();
  if (Platform.OS !== 'web') {
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
  }
  await library.withTransactionAsync(() => library.execAsync(REMOVE_LEGACY_SAMPLE_SQL));
}

export async function syncRemoteCatalog(): Promise<void> {
  try {
    const remote = await cloud.request<{
      items: Array<{ id: string; title: string; total: number; version: string }>;
      total: number;
    }>('/public/books?page_size=100', undefined, 'GET', 12000);
    if (remote && Array.isArray(remote.items)) {
      if (Platform.OS === 'web') {
        for (const b of remote.items) {
          const prog = getWebProgress(b.id);
          webBooksMap.set(b.id, {
            id: b.id,
            title: b.title,
            total: b.total,
            version: b.version,
            source: 'cloud',
            updated_at: new Date().toISOString(),
            chapter_id: prog?.chapter_id || null,
            offset: prog?.offset || null,
            chapter_title: prog?.chapter_title || null,
            position: prog?.position != null ? prog.position : null,
          });
        }
        return;
      }
      await library.withTransactionAsync(async () => {
        for (const b of remote.items) {
          const existing = await library.getFirstAsync<{ id: string; total: number; title: string; version?: string }>(
            'SELECT id, total, title, version FROM books WHERE id=?',
            b.id,
          );
          if (!existing) {
            await library.runAsync(
              'INSERT INTO books(id,title,total,version,source,updated_at) VALUES (?,?,?,?,?,?)',
              b.id,
              b.title,
              b.total,
              b.version || '',
              'cloud',
              new Date().toISOString(),
            );
          } else if (existing.total !== b.total || existing.title !== b.title || existing.version !== b.version) {
            await library.runAsync(
              'UPDATE books SET title=?, total=?, version=?, updated_at=? WHERE id=?',
              b.title,
              b.total,
              b.version || '',
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
  if (Platform.OS === 'web') {
    return Array.from(webBooksMap.values());
  }
  if (cloud.user)
    return library.getAllAsync<Book>(
      `SELECT b.*,
              COALESCE(ap.chapter_id, p.chapter_id) AS chapter_id,
              COALESCE(ap.offset, p.offset) AS offset,
              c.title AS chapter_title,
              c.position
       FROM books b
       LEFT JOIN account_progress ap ON ap.book_id=b.id AND ap.user_id=?
       LEFT JOIN progress p ON p.book_id=b.id
       LEFT JOIN chapters c ON c.book_id=b.id AND c.id=COALESCE(ap.chapter_id, p.chapter_id)
       ORDER BY COALESCE(ap.updated_at, p.updated_at, b.updated_at) DESC`,
      cloud.user.id,
    );
  return library.getAllAsync<Book>(
    `SELECT b.*,
            p.chapter_id,
            p.offset,
            c.title AS chapter_title,
            c.position
     FROM books b
     LEFT JOIN progress p ON p.book_id=b.id
     LEFT JOIN chapters c ON c.book_id=b.id AND c.id=p.chapter_id
     ORDER BY COALESCE(p.updated_at, b.updated_at) DESC`,
  );
}
export async function getChapterPage(
  bookId: string,
  query = '',
  markedOnly = false,
  page = 0,
): Promise<{ rows: ChapterMeta[]; total: number }> {
  if (Platform.OS === 'web') {
    if (markedOnly) {
      return { rows: [], total: 0 };
    }
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
        for (const it of remote.items) {
          const key = `${bookId}:${it.id}`;
          if (!webChaptersCache.has(key)) {
            webChaptersCache.set(key, {
              id: it.id,
              book_id: bookId,
              position: it.position,
              number: it.number,
              title: it.title,
              content: '',
              url: '',
              marked: isWebMarked(bookId, it.id) ? 1 : 0,
            });
          }
        }
        let rows: ChapterMeta[] = remote.items.map((it) => ({
          id: it.id,
          position: it.position,
          number: it.number,
          title: it.title,
          marked: isWebMarked(bookId, it.id) ? 1 : 0,
        }));
        if (query.trim()) {
          const fq = fold(query.trim());
          rows = rows.filter((r) => fold(r.title).includes(fq));
        }
        return { rows, total: remote.total };
      }
    } catch (err) {
      console.warn('getChapterPage web error:', err);
    }
    if (bookId === meta.bookId) {
      let list = debaToc;
      if (query.trim()) {
        const fq = fold(query.trim());
        list = list.filter((r) => fold(r.title).includes(fq));
      }
      const start = page * CHAPTER_PAGE_SIZE;
      const slice = list.slice(start, start + CHAPTER_PAGE_SIZE);
      for (const it of slice) {
        const key = `${bookId}:${it.id}`;
        if (!webChaptersCache.has(key)) {
          webChaptersCache.set(key, {
            id: it.id,
            book_id: bookId,
            position: it.position,
            number: it.number,
            title: it.title,
            content: '',
            url: '',
            marked: isWebMarked(bookId, it.id) ? 1 : 0,
          });
        }
      }
      return {
        rows: slice.map((it) => ({
          id: it.id,
          position: it.position,
          number: it.number,
          title: it.title,
          marked: isWebMarked(bookId, it.id) ? 1 : 0,
        })),
        total: list.length,
      };
    }
    return { rows: [], total: 0 };
  }

  const sql = chapterPageQuery(bookId, query, markedOnly, page);
  const count = await library.getFirstAsync<{ total: number }>(sql.countSQL, ...sql.countArgs);
  let rows = await library.getAllAsync<ChapterMeta>(sql.rowsSQL, ...sql.rowArgs);
  let total = count?.total || 0;

  if (markedOnly || query.trim()) {
    return { rows, total };
  }

  const bookInfo = await library.getFirstAsync<{ total: number }>('SELECT total FROM books WHERE id=?', bookId);
  const bookTotal = bookInfo?.total || total;
  const expectedCount = Math.min(CHAPTER_PAGE_SIZE, Math.max(0, bookTotal - page * CHAPTER_PAGE_SIZE));

  if (rows.length < expectedCount) {
    try {
      const remote = await cloud.request<{
        items: Array<{ id: string; position: number; number: number; title: string }>;
        total: number;
      }>(
        `/public/books/${bookId}/chapters?page=${page + 1}&page_size=${CHAPTER_PAGE_SIZE}`,
        undefined,
        'GET',
        8000,
      );
      if (remote && Array.isArray(remote.items) && remote.items.length > 0) {
        await library.withTransactionAsync(async () => {
          for (const item of remote.items) {
            await library.runAsync(
              'INSERT INTO chapters(id,book_id,position,number,title,content,url,search_title) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(book_id, id) DO UPDATE SET position=excluded.position, number=excluded.number, title=excluded.title, search_title=excluded.search_title',
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
        total = remote.total || bookTotal;
        rows = await library.getAllAsync<ChapterMeta>(sql.rowsSQL, ...sql.rowArgs);
      }
    } catch (err) {
      console.warn('getChapterPage remote error:', err);
    }
  }

  return { rows, total: Math.max(total, bookTotal) };
}
export { CHAPTER_PAGE_SIZE };
export async function getChapterAt(bookId: string, position: number): Promise<ChapterMeta | null> {
  if (Platform.OS === 'web') {
    for (const c of webChaptersCache.values()) {
      if (c.book_id === bookId && c.position === position) {
        return {
          id: c.id,
          position: c.position,
          number: c.number,
          title: c.title,
          marked: c.marked,
        };
      }
    }
    try {
      const remote = await cloud.request<{
        id: string;
        position: number;
        number: number;
        title: string;
        content?: string;
      }>(`/public/books/${bookId}/chapters/${position}`, undefined, 'GET', 5000);
      if (remote && remote.id) {
        const item: Chapter = {
          id: remote.id,
          book_id: bookId,
          position: remote.position,
          number: remote.number,
          title: remote.title,
          content: remote.content || '',
          url: '',
          marked: isWebMarked(bookId, remote.id) ? 1 : 0,
        };
        webChaptersCache.set(`${bookId}:${remote.id}`, item);
        return {
          id: remote.id,
          position: remote.position,
          number: remote.number,
          title: remote.title,
          marked: item.marked,
        };
      }
    } catch (err) {
      console.warn('getChapterAt web remote error:', err);
    }
    if (bookId === meta.bookId && debaToc[position]) {
      const item = debaToc[position];
      const key = `${bookId}:${item.id}`;
      if (!webChaptersCache.has(key)) {
        webChaptersCache.set(key, {
          id: item.id,
          book_id: bookId,
          position: item.position,
          number: item.number,
          title: item.title,
          content: '',
          url: '',
          marked: isWebMarked(bookId, item.id) ? 1 : 0,
        });
      }
      return {
        id: item.id,
        position: item.position,
        number: item.number,
        title: item.title,
        marked: isWebMarked(bookId, item.id) ? 1 : 0,
      };
    }
    return null;
  }

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
    }>(`/public/books/${bookId}/chapters/${position}`, undefined, 'GET', 8000);
    if (remote && remote.id) {
      await library.runAsync(
        'INSERT INTO chapters(id,book_id,position,number,title,content,url,search_title) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(book_id, id) DO UPDATE SET position=excluded.position, number=excluded.number, title=excluded.title, content=CASE WHEN excluded.content != "" THEN excluded.content ELSE chapters.content END, search_title=excluded.search_title',
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
  if (Platform.OS === 'web') {
    const book = webBooksMap.get(bookId);
    if (book && nextPos >= book.total) return null;
    return getChapterAt(bookId, nextPos);
  }
  const book = await library.getFirstAsync<{ total: number }>(
    'SELECT total FROM books WHERE id=?',
    bookId,
  );
  if (book && nextPos >= book.total) return null;

  return getChapterAt(bookId, nextPos);
}
export async function getChapter(bookId: string, id: string): Promise<Chapter | null> {
  if (Platform.OS === 'web') {
    const key = `${bookId}:${id}`;
    let item = webChaptersCache.get(key);
    if (item && item.content) return item;
    const pos = item ? item.position : 0;
    try {
      const remote = await cloud.request<{
        id: string;
        content: string;
        position: number;
        number: number;
        title: string;
      }>(`/public/books/${bookId}/chapters/${pos}`, undefined, 'GET', 5000);
      if (remote && remote.content) {
        item = {
          id: remote.id,
          book_id: bookId,
          position: remote.position,
          number: remote.number,
          title: remote.title,
          content: remote.content,
          url: '',
          marked: isWebMarked(bookId, remote.id) ? 1 : 0,
        };
        webChaptersCache.set(key, item);
        return item;
      }
    } catch (err) {
      console.warn('getChapter web remote error:', err);
    }
    if (bookId === meta.bookId) {
      try {
        const bundled = await getBundledContent(bookId, pos, id);
        if (bundled) {
          const title = item?.title || debaToc[pos]?.title || `Chương ${pos + 1}`;
          const finalItem: Chapter = {
            id,
            book_id: bookId,
            position: pos,
            number: pos + 1,
            title,
            content: bundled,
            url: '',
            marked: isWebMarked(bookId, id) ? 1 : 0,
          };
          webChaptersCache.set(key, finalItem);
          return finalItem;
        }
      } catch (err) {
        console.warn('getBundledContent web error:', err);
      }
    }
    return item || null;
  }

  let row = await library.getFirstAsync<Chapter>(
    `SELECT c.*,CASE WHEN m.chapter_id IS NULL THEN 0 ELSE 1 END AS marked
    FROM chapters c LEFT JOIN bookmarks m ON m.book_id=c.book_id AND m.chapter_id=c.id WHERE c.book_id=? AND c.id=?`,
    bookId,
    id,
  );
  if (!row) {
    try {
      const remote = await cloud.request<{
        id: string;
        position: number;
        number: number;
        title: string;
        content?: string;
      }>(`/public/books/${bookId}/chapters/by-id/${id}`, undefined, 'GET', 8000);
      if (remote && remote.id) {
        await library.runAsync(
          'INSERT INTO chapters(id,book_id,position,number,title,content,url,search_title) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(book_id, id) DO UPDATE SET position=excluded.position, number=excluded.number, title=excluded.title, content=excluded.content, search_title=excluded.search_title',
          remote.id,
          bookId,
          remote.position,
          remote.number,
          remote.title,
          remote.content || '',
          '',
          fold(remote.title),
        );
        row = await library.getFirstAsync<Chapter>(
          `SELECT c.*,CASE WHEN m.chapter_id IS NULL THEN 0 ELSE 1 END AS marked
          FROM chapters c LEFT JOIN bookmarks m ON m.book_id=c.book_id AND m.chapter_id=c.id WHERE c.book_id=? AND c.id=?`,
          bookId,
          id,
        );
      }
    } catch (err) {
      console.warn('getChapter by-id remote error:', err);
    }
  }
  if (row && !row.content) {
    row.content = await readLocalFirst(
      () => getBundledContent(bookId, row.position, row.id),
      async () => {
        const remote = await cloud.request<{ id: string; content: string }>(
          `/public/books/${bookId}/chapters/${row.position}`,
          undefined,
          'GET',
          8000,
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
  if (Platform.OS === 'web') {
    saveWebProgress(bookId, chapterId, offset);
    if (cloud.user) {
      const b = webBooksMap.get(bookId);
      const ver = bookId === meta.bookId ? meta.hash : (b?.version || '20261026045840');
      await cloud.queue(bookId, {
        chapter_id: chapterId,
        version: ver,
        location_kind: 'pixel',
        location_value: Math.max(0, offset),
      });
    }
    return;
  }

  const now = new Date().toISOString();
  await library.runAsync(
    'INSERT OR REPLACE INTO progress(book_id,chapter_id,offset,updated_at) VALUES (?,?,?,?)',
    bookId,
    chapterId,
    Math.max(0, offset),
    now,
  );

  if (cloud.user) {
    await library.runAsync(
      'INSERT OR REPLACE INTO account_progress(user_id,book_id,chapter_id,offset,updated_at) VALUES(?,?,?,?,?)',
      cloud.user.id,
      bookId,
      chapterId,
      Math.max(0, offset),
      now,
    );
    const b = await library.getFirstAsync<{ version?: string }>('SELECT version FROM books WHERE id=?', bookId);
    const ver = bookId === meta.bookId ? meta.hash : (b?.version || '20261026045840');
    await cloud.queue(bookId, {
      chapter_id: chapterId,
      version: ver,
      location_kind: 'pixel',
      location_value: Math.max(0, offset),
    });
  }
}
export async function toggleBookmark(bookId: string, chapterId: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const key = `${bookId}:${chapterId}`;
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('moc_marks') : null;
    let marks: string[] = raw ? JSON.parse(raw) : [];
    let marked = false;
    if (marks.includes(key)) {
      marks = marks.filter((m) => m !== key);
    } else {
      marks.push(key);
      marked = true;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('moc_marks', JSON.stringify(marks));
    }
    const ch = webChaptersCache.get(key);
    if (ch) ch.marked = marked ? 1 : 0;
    return marked;
  }
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
  if (Platform.OS === 'web') {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('moc_settings') : null;
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_SETTINGS;
  }
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
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('moc_settings', JSON.stringify(value));
      }
    } catch {}
    return;
  }
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
