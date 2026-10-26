import {
  ArrowDown,
  Bookmark as BookmarkIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPage, getSearch } from '../../data/catalog';
import { useReaderState } from '../../data/reader-store';
import { pageItems, searchChapters } from '../../domain/book-utils';
import type { Book } from '../../domain/types';

import { useResource } from '../../hooks/use-resource';
import { number } from '../../ui/format';
import { ErrorMessage, IconButton, Loading } from '../../ui/primitives';
export function Toc({
  book,
  currentPosition = 0,
  onSelect,
}: {
  book: Book;
  currentPosition?: number;
  onSelect: (position: number) => void;
}) {
  const { bookmarks } = useReaderState();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [marked, setMarked] = useState(false);
  const [page, setPage] = useState(() => Math.floor(currentPosition / book.pageSize));
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 220);
    return () => clearTimeout(timer);
  }, [query]);
  const saved = useMemo(
    () =>
      new Set(bookmarks.filter((item) => item.bookId === book.id).map((item) => item.chapterId)),
    [bookmarks, book.id],
  );
  const loader = useCallback(async () => {
    if (!debounced.trim() && !marked) return { rows: await getPage(book, page), total: book.total };
    const index = await getSearch(book);
    const filtered = searchChapters(index, debounced).filter(
      (item) => !marked || saved.has(item.id),
    );
    return { rows: pageItems(filtered, page, book.pageSize), total: filtered.length };
  }, [book, page, debounced, marked, saved]);
  const { value, error, retry } = useResource(
    `${book.id}:${book.version}:${page}:${debounced}:${marked}`,
    loader,
  );
  const busy = !value && !error;
  const pages = Math.max(1, Math.ceil((value?.total ?? book.total) / book.pageSize));
  return (
    <div className="toc">
      <div className="toc-tools">
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Tìm tên hoặc số chương"
            placeholder="Tìm tên hoặc số chương…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
          {query && (
            <IconButton
              label="Xóa tìm kiếm chương"
              onClick={() => {
                setQuery('');
                setPage(0);
              }}
            >
              <X size={16} />
            </IconButton>
          )}
        </label>
        <button
          className={`button compact ${marked ? 'primary' : 'secondary'}`}
          aria-pressed={marked}
          onClick={() => {
            setMarked((value) => !value);
            setPage(0);
          }}
        >
          <BookmarkIcon size={16} />
          Đã lưu
        </button>
      </div>
      <div className="toc-caption">
        <span>
          {value ? number(value.total) : '…'} mục · {book.pageSize} mục / trang
        </span>
        <button
          className="text-button"
          onClick={() => {
            setQuery('');
            setDebounced('');
            setMarked(false);
            setPage(Math.floor(currentPosition / book.pageSize));
          }}
        >
          Vị trí đang đọc <ArrowDown size={13} />
        </button>
      </div>
      <div className="chapter-list" aria-busy={busy}>
        {error ? (
          <ErrorMessage message={error} retry={retry} />
        ) : busy ? (
          <Loading text="Đang mở mục lục…" />
        ) : !value?.rows.length ? (
          <div className="empty-state">
            <Search size={30} />
            <h3>Không tìm thấy chương</h3>
            <p>Thử tên khác hoặc bỏ bộ lọc đã lưu.</p>
          </div>
        ) : (
          value.rows.map((item) => (
            <button
              key={item.id}
              className={`chapter-row ${item.position === currentPosition ? 'current' : ''}`}
              onClick={() => onSelect(item.position)}
            >
              <span className="chapter-number">{item.position + 1}</span>
              <span className="chapter-row-title">
                {item.position === currentPosition && <small>ĐANG ĐỌC</small>}
                {item.title}
              </span>
              {saved.has(item.id) ? (
                <BookmarkIcon size={16} fill="currentColor" />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          ))
        )}
      </div>
      <div className="pagination">
        <button
          className="button secondary compact"
          aria-label="Trang mục lục trước"
          disabled={page === 0 || busy}
          onClick={() => setPage((value) => value - 1)}
        >
          <ChevronLeft size={17} />
          Trước
        </button>
        <span>
          Trang <strong>{page + 1}</strong> / {pages}
        </span>
        <button
          className="button secondary compact"
          aria-label="Trang mục lục tiếp theo"
          disabled={page + 1 >= pages || busy}
          onClick={() => setPage((value) => value + 1)}
        >
          Sau
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
