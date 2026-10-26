export type Theme = 'paper' | 'sepia' | 'night';
export type Book = {
  id: string;
  title: string;
  total: number;
  version: string;
  basePath: string;
  chunks: string[];
  pageSize: number;
  pageCount: number;
  source?: 'local' | 'cloud';
};
export type ChapterMeta = { id: string; position: number; number: number; title: string };
export type Chapter = ChapterMeta & { content: string };
export type Progress = {
  bookId: string;
  chapterId: string;
  title: string;
  position: number;
  ratio: number;
  version: string;
  updatedAt: number;
};
export type Bookmark = {
  bookId: string;
  chapterId: string;
  title: string;
  position: number;
  version: string;
  createdAt: number;
};
export type Preferences = { theme: Theme; fontSize: number; lineHeight: number; serif: boolean };
export type ReaderState = {
  preferences: Preferences;
  progress: Record<string, Progress>;
  bookmarks: Bookmark[];
};
export type ChapterPreview = {
  position: number;
  number: number;
  title: string;
  excerpt: string;
};
export type BookPreview = {
  id: string;
  title: string;
  total: number;
  version: string;
  duration_seconds: number;
  first_chapters: ChapterPreview[];
  last_chapters: ChapterPreview[];
};
export type BookUploadResult = {
  id: string;
  title: string;
  total: number;
  version: string;
  duration_seconds: number;
  exported_chunks: boolean;
  message: string;
};
