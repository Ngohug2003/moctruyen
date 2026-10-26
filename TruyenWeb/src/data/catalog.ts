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
  const chapters = await getSearch(book);
  return chapters.find((chapter) => chapter.id === progress.chapterId)?.position ?? 0;
}

export async function getLibrary(): Promise<Book[]> {
  return readLocalFirst(
    async () => {
      const books = await getLocalLibrary();
      if (!books.length) throw new Error('Chưa có truyện trong file JSON.');
      return books;
    },
    async () => {
      const result = await cloud.request<{ items: Book[] }>(
        '/public/books?page_size=100',
        undefined,
        'GET',
        1500,
      );
      return result.items.map((book) => ({
        ...book,
        title: book.title.normalize('NFC'),
        pageSize: 50,
        pageCount: Math.ceil(book.total / 50),
        basePath: `books/${book.id}/${book.version}`,
        chunks: Array.from({ length: Math.ceil(book.total / 50) }, (_, i) => `content-${i}.json`),
      }));
    },
  );
}
export async function getPage(book: Book, page: number): Promise<ChapterMeta[]> {
  return readLocalFirst(
    () => getLocalPage(book, page),
    async () =>
      (
        await cloud.request<{ items: ChapterMeta[] }>(
          `/public/books/${book.id}/chapters?page=${page + 1}&page_size=50`,
          undefined,
          'GET',
          1500,
        )
      ).items.map(normalizeTitle),
  );
}
export async function getSearch(book: Book): Promise<ChapterMeta[]> {
  return readLocalFirst(
    () => getLocalSearch(book),
    async () => {
      const rows: ChapterMeta[] = [];
      for (let page = 0; page < book.pageCount; page++) rows.push(...(await getPage(book, page)));
      return rows;
    },
  );
}
export async function getChapter(book: Book, position: number): Promise<Chapter> {
  return readLocalFirst(
    () => getLocalChapter(book, position),
    () =>
      cloud.request<Chapter>(
        `/public/books/${book.id}/chapters/${position}`,
        undefined,
        'GET',
        1500,
      ),
  );
}
