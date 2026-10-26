import type { ChapterMeta } from './types';

export function fold(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}
export function searchChapters(chapters: ChapterMeta[], query: string) {
  const text = fold(query.trim());
  if (!text) return chapters;
  if (/^\d+$/.test(text)) return chapters.filter((chapter) => chapter.number === Number(text));
  return chapters.filter((chapter) => fold(chapter.title).includes(text));
}
export function pageItems<T>(items: T[], page: number, size = 50) {
  return items.slice(page * size, (page + 1) * size);
}
export function safeRatio(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
export function validPosition(value: unknown, total: number) {
  const position = Number(value);
  return Number.isSafeInteger(position) && position >= 0 && position < total;
}
