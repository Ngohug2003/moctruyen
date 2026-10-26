import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { useReaderState } from '../../data/reader-store';
import type { Book, Progress } from '../../domain/types';
import { CultivationButton } from '../cultivation/CultivationGuide';

import { navigate } from '../../navigation';
import { number } from '../../ui/format';
import { Cover } from '../../ui/primitives';
import { Toc } from '../reader/Toc';
export function BookDetails({
  book,
  read,
}: {
  book: Book;
  read: (book: Book, progress?: Progress) => void;
}) {
  const { progress } = useReaderState();
  return (
    <div className="page book-details entrance">
      <button className="text-button back-link" onClick={() => navigate('/')}>
        <ArrowLeft size={16} />
        Về thư viện
      </button>
      <section className="book-overview">
        <Cover title={book.title} large />
        <div>
          <span className="eyebrow">MỘC · THƯ VIỆN TRUYỆN</span>
          <h1>{book.title}</h1>
          <p>{number(book.total)} chương & phần</p>
          <p className="muted overview-copy">
            Hành trình của bạn luôn được giữ lại.
            <br />
            Mở một chương, bước vào một thế giới.
          </p>
          <button className="button primary" onClick={() => read(book, progress[book.id])}>
            <BookOpen size={17} />
            {progress[book.id] ? 'Tiếp tục đọc' : 'Bắt đầu đọc'}
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
      <CultivationButton bookId={book.id} />
      <div className="section-heading">
        <h2>Mục lục</h2>
        <span className="muted small">Theo thứ tự chương & phần</span>
      </div>
      <div className="toc-panel">
        <Toc
          key={book.id}
          book={book}
          currentPosition={Math.min(book.total - 1, progress[book.id]?.position || 0)}
          onSelect={(position) => navigate(`/read/${book.id}/${position}`)}
        />
      </div>
    </div>
  );
}
