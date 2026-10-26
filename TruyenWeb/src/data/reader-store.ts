import { useSyncExternalStore } from 'react';
import { cloud } from '../api/cloud';
import { safeRatio } from '../domain/book-utils';
import type { Bookmark, Preferences, Progress, ReaderState } from '../domain/types';

let key = 'moc-web-reader-v1';
let accountId: string | null = null;
const defaults: ReaderState = {
  preferences: { theme: 'paper', fontSize: 22, lineHeight: 1.9, serif: true },
  progress: {},
  bookmarks: [],
};
function readState(): ReaderState {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    if (!raw || typeof raw !== 'object') return defaults;
    const preferences = raw.preferences || {};
    return {
      preferences: {
        theme: ['paper', 'sepia', 'night'].includes(preferences.theme)
          ? preferences.theme
          : 'paper',
        fontSize: Math.min(32, Math.max(16, Number(preferences.fontSize) || 22)),
        lineHeight: Math.min(2.3, Math.max(1.5, Number(preferences.lineHeight) || 1.9)),
        serif: preferences.serif !== false,
      },
      progress: Object.fromEntries(
        Object.entries(raw.progress || {}).filter((entry): entry is [string, Progress] => {
          const progress = entry[1] as Progress;
          return (
            progress &&
            typeof progress.chapterId === 'string' &&
            typeof progress.version === 'string' &&
            Number.isSafeInteger(progress.position) &&
            progress.position >= 0
          );
        }),
      ),
      bookmarks: Array.isArray(raw.bookmarks)
        ? raw.bookmarks.filter(
            (item: Bookmark) =>
              item &&
              typeof item.bookId === 'string' &&
              typeof item.chapterId === 'string' &&
              typeof item.version === 'string' &&
              Number.isSafeInteger(item.position) &&
              item.position >= 0,
          )
        : [],
    };
  } catch {
    return defaults;
  }
}
let state = readState();
let storageFailed = false;
const subscribers = new Set<() => void>();
function publish(next: ReaderState) {
  state = next;
  try {
    localStorage.setItem(key, JSON.stringify(next));
    storageFailed = false;
  } catch {
    storageFailed = true;
  }
  subscribers.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};
window.addEventListener('storage', (event) => {
  if (event.key === key) {
    state = readState();
    subscribers.forEach((listener) => listener());
  }
});
export const useReaderState = () => useSyncExternalStore(subscribe, () => state);
export const hasStorageError = () => storageFailed;
export const setPreferences = (patch: Partial<Preferences>) =>
  publish({ ...state, preferences: { ...state.preferences, ...patch } });
export function saveProgress(progress: Progress) {
  void cloud.queue(progress.bookId, {
    chapter_id: progress.chapterId,
    version: progress.version,
    location_kind: 'ratio',
    location_value: safeRatio(progress.ratio),
  });
  publish({
    ...state,
    progress: {
      ...state.progress,
      [progress.bookId]: { ...progress, ratio: safeRatio(progress.ratio) },
    },
  });
}
export function toggleBookmark(bookmark: Bookmark) {
  const exists = state.bookmarks.some(
    (item) => item.bookId === bookmark.bookId && item.chapterId === bookmark.chapterId,
  );
  publish({
    ...state,
    bookmarks: exists
      ? state.bookmarks.filter(
          (item) => item.bookId !== bookmark.bookId || item.chapterId !== bookmark.chapterId,
        )
      : [...state.bookmarks, bookmark],
  });
}

cloud.subscribe(() => {
  const id = cloud.user?.id || null;
  if (id === accountId) return;
  accountId = id;
  key = id ? 'moc-web-reader-account-' + id : 'moc-web-reader-v1';
  publish({ ...readState(), preferences: state.preferences });
});
cloud.receive((rows) => {
  const progress = { ...state.progress };
  for (const row of rows)
    progress[row.book_id] = {
      bookId: row.book_id,
      chapterId: row.chapter_id,
      title: row.title,
      position: row.position,
      ratio: row.location_kind === 'ratio' ? row.ratio : 0,
      version: row.version,
      updatedAt: Date.parse(row.updated_at),
    };
  publish({ ...state, progress });
});
void cloud.init().then(() => cloud.sync());
