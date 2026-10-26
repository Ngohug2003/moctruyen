import { BookOpen, Bookmark as BookmarkIcon, Leaf, Search, Settings2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import './App.css';
import { getLibrary, resumePosition } from './data/catalog';
import { hasStorageError, useReaderState } from './data/reader-store';
import { validPosition } from './domain/book-utils';
import type { Book, Progress } from './domain/types';
import { AccountPanel } from './features/account/AccountPanel';

import { BookDetails } from './features/library/BookDetails';
import { Library } from './features/library/Library';
import { Saved } from './features/library/Saved';
import { Preferences } from './features/preferences/Preferences';
import { ReaderRoute } from './features/reader/ReaderScreen';
import { useResource } from './hooks/use-resource';
import { navigate, useRoute } from './navigation';
import { Brand, ErrorMessage, IconButton, Loading } from './ui/primitives';
export default function App() {
  const route = useRoute();
  const routeKind = route[0];
  const routeBook = route[1];
  const state = useReaderState();
  const { value: books, error, retry } = useResource('library', getLibrary);
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState('');
  const [opening, setOpening] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = state.preferences.theme;
  }, [state.preferences.theme]);
  useEffect(() => {
    if (routeKind !== 'read') {
      document.title = 'Mộc · Không gian đọc truyện';
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [routeKind, routeBook]);
  async function read(book: Book, progress?: Pick<Progress, 'chapterId' | 'position' | 'version'>) {
    setOpening(true);
    setNotice('');
    try {
      navigate(`/read/${book.id}/${await resumePosition(book, progress)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Chưa mở được truyện.');
    } finally {
      setOpening(false);
    }
  }
  if (error)
    return (
      <div className="boot">
        <Brand />
        <ErrorMessage message={error} retry={retry} />
      </div>
    );
  if (!books)
    return (
      <div className="boot">
        <Brand />
        <Loading text="Đang mở thư viện Mộc…" />
      </div>
    );
  const activeBook = books.find((book) => book.id === route[1]);
  const isReader = route[0] === 'read' && activeBook && validPosition(route[2], activeBook.total);
  const unknown =
    !!route[0] && route[0] !== 'saved' && !((route[0] === 'book' || isReader) && activeBook);
  return (
    <>
      {hasStorageError() && (
        <div className="storage-notice" role="alert">
          Trình duyệt chưa lưu được vị trí đọc. Hãy kiểm tra dung lượng hoặc quyền lưu dữ liệu.
        </div>
      )}
      {isReader ? (
        <ReaderRoute
          key={`${activeBook.id}:${route[2]}`}
          book={activeBook}
          position={Number(route[2])}
        />
      ) : (
        <div className="app-shell">
          <aside className="sidebar">
            <Brand />
            <div className="sidebar-section">KHÁM PHÁ</div>
            <nav aria-label="Điều hướng chính">
              <button
                className={`nav-link ${route[0] !== 'saved' ? 'selected' : ''}`}
                onClick={() => navigate('/')}
              >
                <BookOpen size={20} />
                Thư viện<span>{books.length}</span>
              </button>
              <button
                className={`nav-link ${route[0] === 'saved' ? 'selected' : ''}`}
                onClick={() => navigate('/saved')}
              >
                <BookmarkIcon size={20} />
                Đã lưu<span>{state.bookmarks.length}</span>
              </button>
            </nav>
            <div className="sidebar-bottom">
              <div className="sidebar-quote">
                <Leaf size={21} strokeWidth={1} />
                <p>
                  Đọc chậm,
                  <br />
                  đi thật xa.
                </p>
              </div>
              <button className="nav-link" onClick={() => setSettings(true)}>
                <Settings2 size={19} />
                Góc đọc của bạn
              </button>
              <small>MỘC · THƯ VIỆN CÁ NHÂN</small>
            </div>
          </aside>
          <main className="main-panel">
            <header className="topbar">
              <span className="topbar-caption">
                <Leaf size={15} />
                Góc đọc của riêng bạn
              </span>
              {!route[0] && (
                <label className="search-box global-search">
                  <Search size={17} />
                  <input
                    aria-label="Tìm truyện trong thư viện"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm truyện trong thư viện…"
                  />
                </label>
              )}
              <AccountPanel />
              <IconButton label="Mở cài đặt giao diện" onClick={() => setSettings(true)}>
                <Settings2 size={19} />
              </IconButton>
            </header>
            {notice && (
              <div className="inline-notice" role="alert">
                {notice}
                <button onClick={() => setNotice('')} aria-label="Đóng thông báo">
                  <X size={16} />
                </button>
              </div>
            )}
            {unknown ? (
              <div className="empty-state">
                <BookOpen size={32} />
                <h1>Trang sách chưa có ở đây</h1>
                <button className="button primary" onClick={() => navigate('/')}>
                  Về thư viện
                </button>
              </div>
            ) : route[0] === 'saved' ? (
              <Saved
                books={books}
                read={(book, progress) => {
                  void read(book, progress);
                }}
              />
            ) : route[0] === 'book' && activeBook ? (
              <BookDetails
                key={activeBook.id}
                book={activeBook}
                read={(book, progress) => {
                  void read(book, progress);
                }}
              />
            ) : (
              <Library
                books={books}
                search={search}
                read={(book, progress) => {
                  void read(book, progress);
                }}
                onReload={retry}
              />
            )}
          </main>
        </div>
      )}
      {opening && (
        <div className="opening-overlay">
          <Loading text="Đang tìm trang sách của bạn…" />
        </div>
      )}
      {settings && <Preferences onClose={() => setSettings(false)} />}
    </>
  );
}
