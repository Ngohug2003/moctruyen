import { readLocalFirst } from '../domain/read-source';
import { cloud } from '../api/cloud';
import type { Book, Chapter, ChapterMeta, Progress } from '../domain/types';

const cache = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();
async function load<T>(path: string, permanent = false): Promise<T> {
  if (!permanent && cache.has(path)) return cache.get(path) as T;
  if (pending.has(path)) return pending.get(path) as Promise<T>;
  const request = fetch(`${import.meta.env.BASE_URL}${path}`, {
    cache: permanent ? 'no-store' : 'default',
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Chưa tải được dữ liệu (${response.status}). Hãy thử lại.`);
      const value: T = await response.json();
      if (!permanent) {
        cache.set(path, value);
        if (cache.size > 8) cache.delete(cache.keys().next().value!);
      }
      return value;
    })
    .finally(() => {
      pending.delete(path);
    });
  pending.set(path, request);
  return request;
}
const getLocalLibrary = async () =>
  (await load<Book[]>('books/index.json', true)).map((book) => ({
    ...book,
    title: book.title.normalize('NFC'),
  }));
const normalizeTitle = (chapter: ChapterMeta) => ({
  ...chapter,
  title: chapter.title.normalize('NFC'),
});
const getLocalPage = async (book: Book, page: number) =>
  (await load<ChapterMeta[]>(`${book.basePath}/toc-${page}.json`)).map(normalizeTitle);
const getLocalSearch = async (book: Book) =>
  (await load<ChapterMeta[]>(`${book.basePath}/search.json`)).map(normalizeTitle);
async function getLocalChapter(book: Book, position: number): Promise<Chapter> {
  const page = Math.floor(position / book.pageSize);
  const [metadata, content] = await Promise.all([
    getLocalPage(book, page),
    load<{ id: string; content: string }[]>(`${book.basePath}/${book.chunks[page]}`),
  ]);
  const chapter = metadata.find((item) => item.position === position);
  const body = content.find((item) => item.id === chapter?.id);
  if (!chapter || !body?.content?.trim())
    throw new Error('Chương này chưa có nội dung trong bản truyện hiện tại.');
  return { ...chapter, content: body.content.normalize('NFC') };
}
export async function resumePosition(
  book: Book,
  progress?: Pick<Progress, 'chapterId' | 'position' | 'version'>,
) {
  if (!progress) return 0;
  if (progress.version === book.version && progress.position < book.total) return progress.position;
  if (progress.chapterId) {
    try {
      const ch = await cloud.request<{ position: number }>(
        `/public/books/${book.id}/chapters/by-id/${progress.chapterId}`,
        undefined,
        'GET',
        4000,
      );
      if (ch && typeof ch.position === 'number' && ch.position >= 0 && ch.position < book.total) {
        return ch.position;
      }
    } catch {}
  }
  if (progress.position != null && progress.position >= 0 && progress.position < book.total) {
    return progress.position;
  }
  const chapters = await getSearch(book);
  return chapters.find((chapter) => chapter.id === progress.chapterId)?.position ?? 0;
}

export async function getLibrary(): Promise<Book[]> {
  try {
    const result = await cloud.request<{ items: Book[] }>(
      '/public/books?page_size=100',
      undefined,
      'GET',
      10000,
    );
    if (result && Array.isArray(result.items) && result.items.length > 0) {
      return result.items.map((book) => ({
        ...book,
        title: book.title.normalize('NFC'),
        pageSize: 50,
        pageCount: Math.ceil(book.total / 50),
        basePath: `books/${book.id}/${book.version}`,
        chunks: Array.from({ length: Math.ceil(book.total / 50) }, (_, i) => `content-${i}.json`),
        source: 'cloud',
      }));
    }
  } catch (err) {
    console.warn('Không tải được danh mục từ API, chuyển sang dữ liệu cục bộ:', err);
  }
  return (await getLocalLibrary()).map((book) => ({
    ...book,
    title: book.title.normalize('NFC'),
    source: 'local',
  }));
}
export async function getPage(book: Book, page: number): Promise<ChapterMeta[]> {
  if (book.source === 'cloud') {
    try {
      const res = await cloud.request<{ items: ChapterMeta[] }>(
        `/public/books/${book.id}/chapters?page=${page + 1}&page_size=50`,
        undefined,
        'GET',
        10000,
      );
      if (res && Array.isArray(res.items)) return res.items.map(normalizeTitle);
    } catch {}
    return getLocalPage(book, page);
  }
  return readLocalFirst(
    () => getLocalPage(book, page),
    async () =>
      (
        await cloud.request<{ items: ChapterMeta[] }>(
          `/public/books/${book.id}/chapters?page=${page + 1}&page_size=50`,
          undefined,
          'GET',
          10000,
        )
      ).items.map(normalizeTitle),
  );
}
export async function getSearch(book: Book): Promise<ChapterMeta[]> {
  const cacheKey = `search:${book.id}:${book.version}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) as ChapterMeta[];

  if (book.source !== 'cloud') {
    try {
      const local = await getLocalSearch(book);
      if (local && local.length > 0) {
        cache.set(cacheKey, local);
        return local;
      }
    } catch {}
  }

  // Fetch chapters in parallel chunks of 100
  const totalPages = Math.ceil(book.total / 100);
  const pagesToFetch = Math.min(totalPages, 50);
  try {
    const chunks = await Promise.all(
      Array.from({ length: pagesToFetch }, (_, i) =>
        cloud
          .request<{ items: ChapterMeta[] }>(
            `/public/books/${book.id}/chapters?page=${i + 1}&page_size=100`,
            undefined,
            'GET',
            15000,
          )
          .then((res) => (res?.items || []).map(normalizeTitle))
          .catch(() => [] as ChapterMeta[]),
      ),
    );
    const rows = chunks.flat();
    if (rows.length > 0) {
      cache.set(cacheKey, rows);
      return rows;
    }
  } catch {}

  return getLocalSearch(book);
}
export async function getChapter(book: Book, position: number): Promise<Chapter> {
  if (book.source === 'cloud') {
    try {
      const res = await cloud.request<Chapter>(
        `/public/books/${book.id}/chapters/${position}`,
        undefined,
        'GET',
        10000,
      );
      if (res && res.content) {
        return { ...res, content: res.content.normalize('NFC') };
      }
    } catch {}
    return getLocalChapter(book, position);
  }
  return readLocalFirst(
    () => getLocalChapter(book, position),
    async () => {
      const res = await cloud.request<Chapter>(
        `/public/books/${book.id}/chapters/${position}`,
        undefined,
        'GET',
        10000,
      );
      return { ...res, content: res.content.normalize('NFC') };
    },
  );
}
