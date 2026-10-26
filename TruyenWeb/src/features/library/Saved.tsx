import { ArrowRight, Bookmark as BookmarkIcon, X } from 'lucide-react';
import { toggleBookmark, useReaderState } from '../../data/reader-store';
import type { Book, Progress } from '../../domain/types';

import { navigate } from '../../navigation';
import { IconButton } from '../../ui/primitives';
export function Saved({
  books,
  read,
}: {
  books: Book[];
  read: (book: Book, progress?: Pick<Progress, 'chapterId' | 'position' | 'version'>) => void;
}) {
  const { bookmarks } = useReaderState();
  const saved = bookmarks
    .filter((item) => books.some((book) => book.id === item.bookId))
    .sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="page entrance">
      <div className="page-intro">
        <div>
          <span className="eyebrow">NHỮNG CÂU CHỮ MUỐN GIỮ LẠI</span>
          <h1>Trang sách đã lưu</h1>
          <p>Một dấu trang nhỏ, để tìm về câu chuyện yêu thích.</p>
        </div>
        <span className="count-badge">{saved.length} dấu trang</span>
      </div>
      {!saved.length ? (
        <div className="empty-state bordered">
          <BookmarkIcon size={35} strokeWidth={1.2} />
          <h2>Chưa có trang sách được lưu</h2>
          <p>Chạm biểu tượng đánh dấu khi đọc để giữ lại chương yêu thích.</p>
          <button className="button primary" onClick={() => navigate('/')}>
            Khám phá thư viện
            <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <div className="saved-list">
          {saved.map((item) => (
            <div className="saved-card" key={`${item.bookId}:${item.chapterId}`}>
              <BookmarkIcon size={21} />
              <button
                className="saved-title"
                onClick={() =>
                  read(
                    books.find((book) => book.id === item.bookId)!,
                    item,
                  )
                }
              >
                <small>{books.find((book) => book.id === item.bookId)?.title}</small>
                <strong>{item.title}</strong>
              </button>
              <IconButton label={`Bỏ lưu ${item.title}`} onClick={() => toggleBookmark(item)}>
                <X size={18} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
