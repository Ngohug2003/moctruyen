import { ArrowRight, BookOpen, Leaf, List, Search } from 'lucide-react';
import { useReaderState } from '../../data/reader-store';
import { fold } from '../../domain/book-utils';
import type { Book, Progress } from '../../domain/types';
import { CultivationButton } from '../cultivation/CultivationGuide';
import { UploadBookButton } from './UploadBookModal';

import { navigate } from '../../navigation';
import { number } from '../../ui/format';
import { Cover, IconButton } from '../../ui/primitives';
export function Library({
  books,
  search,
  read,
  onReload,
}: {
  books: Book[];
  search: string;
  read: (book: Book, progress?: Progress) => void;
  onReload?: () => void;
}) {
  const { progress } = useReaderState();
  const featured = [...books].sort(
    (a, b) => (progress[b.id]?.updatedAt || 0) - (progress[a.id]?.updatedAt || 0),
  )[0];
  const visible = books.filter((book) => fold(book.title).includes(fold(search)));
  const latest = featured && progress[featured.id];
  return (
    <div className="page entrance">
      <div className="page-intro">
        <div>
          <span className="eyebrow">MỘT KHOẢNG RIÊNG CHO TRANG SÁCH</span>
          <h1>Thư viện của bạn</h1>
          <p>Những câu chuyện hay, luôn ở đây chờ bạn.</p>
        </div>
        <div className="library-stats">
          <UploadBookButton onSaved={onReload} />
          <div>
            <strong>{number(books.length)}</strong>
            <span>CUỐN SÁCH</span>
          </div>
          <div>
            <strong>{number(books.reduce((sum, book) => sum + book.total, 0))}</strong>
            <span>CHƯƠNG & PHẦN</span>
          </div>
        </div>
      </div>
      {featured && (
        <div className="feature-layout">
          <section className="featured">
            <Leaf className="featured-leaf" aria-hidden="true" />
            <div className="featured-info">
              <span className="eyebrow light">
                <i />
                {latest ? 'TIẾP NỐI CÂU CHUYỆN' : 'MỞ MỘT HÀNH TRÌNH MỚI'}
              </span>
              <h2>{featured.title}</h2>
              <p className="featured-chapter">
                {latest?.title || `${number(featured.total)} chương & phần đang chờ bạn khám phá.`}
              </p>
              <div className="featured-progress">
                <span>
                  {latest
                    ? `Mục ${number(latest.position + 1)} / ${number(featured.total)}`
                    : 'Mỗi ngày, thêm một trang sách.'}
                </span>
                <span>
                  {latest ? `${Math.round(((latest.position + 1) / featured.total) * 100)}%` : ''}
                </span>
              </div>
              <div className="progress-track">
                <span
                  style={{
                    width: `${latest ? ((latest.position + 1) / featured.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <button className="button cream" onClick={() => read(featured, latest)}>
                <BookOpen size={17} />
                {latest ? 'Đọc tiếp' : 'Bắt đầu đọc'}
                <ArrowRight size={17} />
              </button>
            </div>
            <div className="featured-cover">
              <Cover title={featured.title} large />
            </div>
          </section>
          <aside className="reading-note">
            <span className="eyebrow">MỘC · GÓC ĐỌC</span>
            <Leaf size={30} strokeWidth={1} />
            <blockquote>
              Đọc chậm,
              <br />
              đi thật xa.
            </blockquote>
            <p>
              Để một câu chuyện đưa bạn
              <br />
              ra khỏi những bộn bề.
            </p>
            <span className="note-line" />
          </aside>
        </div>
      )}
      {featured && <CultivationButton bookId={featured.id} />}
      <div className="section-heading">
        <h2>
          Tất cả sách <span>{visible.length}</span>
        </h2>
        <span className="muted small">Một thế giới trên từng trang giấy</span>
      </div>
      {visible.length ? (
        <div className="book-grid">
          {visible.map((book) => (
            <article className="book-card" key={book.id}>
              <button
                className="cover-button"
                aria-label={`Xem mục lục ${book.title}`}
                onClick={() => navigate(`/book/${book.id}`)}
              >
                <Cover title={book.title} />
              </button>
              <div className="book-card-info">
                <span className="eyebrow">TRUYỆN CHỮ</span>
                <h3>
                  <button onClick={() => navigate(`/book/${book.id}`)}>{book.title}</button>
                </h3>
                <p>{number(book.total)} chương & phần</p>
                <div className="book-card-status">
                  {progress[book.id]
                    ? `Đang đọc mục ${number(progress[book.id].position + 1)}`
                    : 'Một hành trình mới đang chờ'}
                </div>
                <div className="book-card-actions">
                  <button className="text-button" onClick={() => read(book, progress[book.id])}>
                    {progress[book.id] ? 'Đọc tiếp' : 'Đọc truyện'}
                    <ArrowRight size={14} />
                  </button>
                  <IconButton
                    label={`Mục lục ${book.title}`}
                    onClick={() => navigate(`/book/${book.id}`)}
                  >
                    <List size={19} />
                  </IconButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Search size={32} />
          <h3>Chưa tìm thấy truyện này</h3>
          <p>Thử tìm bằng một tên ngắn hơn.</p>
        </div>
      )}
      <footer className="page-footer">
        <span />
        <Leaf size={16} />
        <p>Một trang nữa thôi, một thế giới nữa mở ra.</p>
        <span />
      </footer>
    </div>
  );
}
