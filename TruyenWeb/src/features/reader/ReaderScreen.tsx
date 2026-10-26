import {
  ArrowLeft,
  ArrowRight,
  Bookmark as BookmarkIcon,
  ChevronLeft,
  ChevronRight,
  Leaf,
  List,
  Settings2,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getChapter } from '../../data/catalog';
import { saveProgress, toggleBookmark, useReaderState } from '../../data/reader-store';
import { safeRatio, validPosition } from '../../domain/book-utils';
import type { Book, Chapter } from '../../domain/types';
import { CultivationButton } from '../cultivation/CultivationGuide';

import { useResource } from '../../hooks/use-resource';
import { navigate } from '../../navigation';
import { number } from '../../ui/format';
import { ErrorMessage, IconButton, Loading, Modal } from '../../ui/primitives';
import { Preferences } from '../preferences/Preferences';
import { Toc } from '../reader/Toc';
export function ReaderRoute({ book, position }: { book: Book; position: number }) {
  const loader = useCallback(() => getChapter(book, position), [book, position]);
  const { value, error, retry } = useResource(`${book.id}:${book.version}:${position}`, loader);
  if (error) return <ErrorMessage message={error} retry={retry} />;
  if (!value) return <Loading />;
  return <Reader key={`${book.id}:${value.id}`} book={book} chapter={value} />;
}
function Reader({ book, chapter }: { book: Book; chapter: Chapter }) {
  const { preferences, progress, bookmarks } = useReaderState();
  const [toc, setToc] = useState(false);
  const [settings, setSettings] = useState(false);
  const initial = progress[book.id];
  const initialRatio = initial?.chapterId === chapter.id ? safeRatio(initial.ratio) : 0;
  const ratio = useRef(initialRatio);
  const [percentage, setPercentage] = useState(() => Math.round(initialRatio * 100));
  const marked = bookmarks.some((item) => item.bookId === book.id && item.chapterId === chapter.id);
  const move = useCallback(
    (step: number) => {
      const target = chapter.position + step;
      if (validPosition(target, book.total)) navigate(`/read/${book.id}/${target}`);
    },
    [book.id, book.total, chapter.position],
  );
  useLayoutEffect(() => {
    window.scrollTo({
      top: ratio.current * Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
      behavior: 'instant',
    });
  }, [preferences.fontSize, preferences.lineHeight, preferences.serif]);
  useEffect(() => {
    document.title = `${chapter.title} · ${book.title} · Mộc`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSaved = 0;
    const persist = () => {
      if (timer) clearTimeout(timer);
      saveProgress({
        bookId: book.id,
        chapterId: chapter.id,
        title: chapter.title,
        position: chapter.position,
        version: book.version,
        ratio: ratio.current,
        updatedAt: Date.now(),
      });
      lastSaved = Date.now();
    };
    const onScroll = () => {
      ratio.current = safeRatio(
        window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight),
      );
      setPercentage(Math.round(ratio.current * 100));
      if (Date.now() - lastSaved > 1500) persist();
      if (timer) clearTimeout(timer);
      timer = setTimeout(persist, 450);
    };
    const onVisibility = () => {
      if (document.hidden) persist();
    };
    persist();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', persist);
    window.addEventListener('moc:before-navigate', persist);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      persist();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', persist);
      window.removeEventListener('moc:before-navigate', persist);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [book.id, book.version, chapter.id, chapter.title, chapter.position, book.title]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        document.querySelector('dialog[open]') ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest('input, textarea, select, [contenteditable]'))
      )
        return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        move(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        move(1);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [move]);
  const bookmark = () =>
    toggleBookmark({
      bookId: book.id,
      chapterId: chapter.id,
      title: chapter.title,
      position: chapter.position,
      version: book.version,
      createdAt: Date.now(),
    });
  return (
    <div className="reader">
      <div className="reading-progress" style={{ width: `${percentage}%` }} />
      <header className="reader-header">
        <button className="text-button" onClick={() => navigate(`/book/${book.id}`)}>
          <ArrowLeft size={17} />
          <span className="desktop-label">Mục lục</span>
        </button>
        <button className="reader-book-title" onClick={() => navigate(`/book/${book.id}`)}>
          <strong>{book.title}</strong>
          <small>
            MỤC {number(chapter.position + 1)} / {number(book.total)}
          </small>
        </button>
        <div className="reader-header-actions">
          <CultivationButton bookId={book.id} />
          <IconButton
            label={marked ? 'Bỏ đánh dấu chương' : 'Đánh dấu chương'}
            active={marked}
            onClick={bookmark}
          >
            <BookmarkIcon size={20} fill={marked ? 'currentColor' : 'none'} />
          </IconButton>
          <IconButton label="Mở cài đặt đọc" onClick={() => setSettings(true)}>
            <Settings2 size={20} />
          </IconButton>
        </div>
      </header>
      <article
        className={`reading-page entrance ${preferences.serif ? 'serif' : 'sans'}`}
        style={{ fontSize: preferences.fontSize, lineHeight: preferences.lineHeight }}
      >
        <div className="reader-chapter-intro">
          <span className="eyebrow">
            {book.title} / MỤC {number(chapter.position + 1)}
          </span>
          <h1>{chapter.title}</h1>
          <div className="chapter-rule" />
        </div>
        <div className="chapter-content">
          {chapter.content
            .split(/\n\s*\n/)
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
        </div>
        <div className="chapter-end">
          <Leaf size={25} strokeWidth={1} />
          <p>Bạn đã đọc hết mục này.</p>
          {chapter.position < book.total - 1 ? (
            <button className="button primary" onClick={() => move(1)}>
              Chương tiếp theo
              <ArrowRight size={17} />
            </button>
          ) : (
            <p>Hẹn bạn ở một câu chuyện mới.</p>
          )}
        </div>
      </article>
      <nav className="reader-toolbar" aria-label="Điều khiển đọc">
        <IconButton label="Chương trước" disabled={chapter.position === 0} onClick={() => move(-1)}>
          <ChevronLeft size={21} />
        </IconButton>
        <button className="toolbar-action" onClick={() => setToc(true)}>
          <List size={20} />
          <span>Mục lục</span>
        </button>
        <span className="reading-percentage">
          <strong>{percentage}%</strong>
          <small>MỤC NÀY</small>
        </span>
        <button className="toolbar-action" onClick={() => setSettings(true)}>
          <span className="font-icon">Aa</span>
          <span>Giao diện</span>
        </button>
        <IconButton
          label="Chương tiếp theo"
          disabled={chapter.position >= book.total - 1}
          onClick={() => move(1)}
        >
          <ChevronRight size={21} />
        </IconButton>
      </nav>
      {toc && (
        <Modal title="Mục lục" drawer onClose={() => setToc(false)}>
          <p className="dialog-intro">{book.title}</p>
          <Toc
            book={book}
            currentPosition={chapter.position}
            onSelect={(position) => {
              setToc(false);
              navigate(`/read/${book.id}/${position}`);
            }}
          />
        </Modal>
      )}
      {settings && <Preferences onClose={() => setSettings(false)} />}
    </div>
  );
}
