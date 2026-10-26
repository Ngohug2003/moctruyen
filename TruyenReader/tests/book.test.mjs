import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseBookText,
  normalizeBook,
  fold,
  SCHEMA,
  APPLY_BUNDLED_BOOK_SQL,
} from '../src/domain/book-format.ts';
import { createBundle } from '../scripts/content/prepare-book.mjs';
const row = (n, url, content = 'Nội dung thử.\n\nĐoạn tiếp theo.') => ({
  ten_truyen: 'Truyện thử',
  so_chuong: n,
  ten_chuong: `Chương ${n}: Khởi đầu`,
  noi_dung: content,
  url,
});

test('BOM, tiếng Việt, đoạn văn và tìm kiếm không dấu', () => {
  const b = parseBookText('\uFEFF' + JSON.stringify([row(1, 'https://example.org/1')]));
  assert.equal(b.chapters[0].content, 'Nội dung thử.\n\nĐoạn tiếp theo.');
  assert.equal(fold('Đế Bá – Khởi Đầu'), 'de ba – khoi dau');
});
test('giữ thứ tự file và các phần cùng số nhưng khác URL', () => {
  const b = normalizeBook([
    row(11, 'https://example.org/11-a'),
    row(11, 'https://example.org/11-b'),
    row(10, 'https://example.org/10'),
  ]);
  assert.deepEqual(
    b.chapters.map((c) => c.number),
    [11, 11, 10],
  );
  assert.equal(new Set(b.chapters.map((c) => c.id)).size, 3);
});
test('loại URL trùng hoàn toàn; từ chối nội dung mâu thuẫn', () => {
  const r = row(1, 'https://example.org/1');
  assert.equal(normalizeBook([r, r]).chapters.length, 1);
  assert.throws(() => normalizeBook([r, { ...r, noi_dung: 'Nội dung khác' }]), /nội dung khác/);
});
test('từ chối file báo cáo, chương rỗng, sai số và nhiều truyện', () => {
  for (const input of [
    { loi: [] },
    [],
    [row(1, '', ' ')],
    [{ ...row(1, ''), so_chuong: '1' }],
    [row(1, ''), { ...row(2, ''), ten_truyen: 'Truyện khác' }],
  ])
    assert.throws(() => normalizeBook(input));
});
test('mã chương ổn định khi đổi vị trí hoặc cập nhật nội dung cùng URL', () => {
  const a = normalizeBook([row(1, 'https://example.org/1')]);
  const b = normalizeBook([
    row(0, 'https://example.org/0'),
    row(1, 'https://example.org/1', 'Văn bản cập nhật'),
  ]);
  assert.equal(a.chapters[0].id, b.chapters[1].id);
});
test('bundle SQLite thật: truy vấn riêng từng phần và bảo toàn tiến độ khi thay nội dung', () => {
  const dir = mkdtempSync(join(tmpdir(), 'moc-reader-'));
  try {
    const input = join(dir, 'truyen.json');
    writeFileSync(
      input,
      JSON.stringify([row(1, 'https://example.org/1-a'), row(1, 'https://example.org/1-b')]),
    );
    const meta = createBundle(input, join(dir, 'assets'));
    assert.equal(meta.demo, false);
    assert.equal(meta.count, 2);
    const db = new DatabaseSync(join(dir, 'assets', 'catalog.db'));
    const rows = db.prepare('SELECT id,number,title,content FROM chapters ORDER BY position').all();
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].id, rows[1].id);
    db.prepare('INSERT INTO progress VALUES (?,?,?,?)').run(meta.bookId, rows[1].id, 357, 'now');
    db.prepare('UPDATE chapters SET content=? WHERE id=?').run('Cập nhật', rows[1].id);
    const progress = db
      .prepare(
        'SELECT p.offset,c.content FROM progress p JOIN chapters c ON c.id=p.chapter_id AND c.book_id=p.book_id',
      )
      .get();
    assert.equal(progress.offset, 357);
    assert.equal(progress.content, 'Cập nhật');
    db.close();
    const bytes = readFileSync(join(dir, 'assets', 'catalog.db'));
    writeFileSync(input, '{');
    assert.throws(() => createBundle(input, join(dir, 'assets')));
    assert.deepEqual(readFileSync(join(dir, 'assets', 'catalog.db')), bytes);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('thiếu JSON báo lỗi và không tự tạo truyện mẫu', () => {
  const dir = mkdtempSync(join(tmpdir(), 'moc-reader-'));
  try {
    assert.throws(() => createBundle(join(dir, 'missing.json'), join(dir, 'assets')), /Chưa có/);
    assert.equal(existsSync(join(dir, 'assets')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('xử lý 7.300 mục tổng hợp, không nhầm chương trùng số', () => {
  const rows = Array.from({ length: 7300 }, (_, i) =>
    row(Math.floor(i / 2) + 1, `https://example.org/${i}`),
  );
  const b = normalizeBook(rows);
  assert.equal(b.chapters.length, 7300);
  assert.equal(b.chapters[7299].position, 7299);
});

test('cập nhật database đóng gói giữ tiến độ, dấu trang và truyện đã nhập khác', () => {
  const dir = mkdtempSync(join(tmpdir(), 'moc-seed-'));
  try {
    const input = join(dir, 'truyen.json');
    writeFileSync(input, JSON.stringify([row(1, 'https://example.org/1')]));
    const meta = createBundle(input, join(dir, 'assets'));
    const app = new DatabaseSync(':memory:');
    app.exec(SCHEMA);
    app.prepare('INSERT INTO books VALUES (?,?,?,?,?)').run('other', 'Truyện khác', 0, '', 'now');
    app.prepare('ATTACH DATABASE ? AS bundled').run(join(dir, 'assets', 'catalog.db'));
    app.exec(APPLY_BUNDLED_BOOK_SQL);
    const chapter = app.prepare('SELECT id FROM chapters WHERE book_id=?').get(meta.bookId);
    app.prepare('INSERT INTO progress VALUES (?,?,?,?)').run(meta.bookId, chapter.id, 432, 'now');
    app.prepare('INSERT INTO bookmarks VALUES (?,?,?)').run(meta.bookId, chapter.id, 'now');
    app.prepare('INSERT INTO bookmarks VALUES (?,?,?)').run(meta.bookId, 'removed', 'now');
    app.exec(APPLY_BUNDLED_BOOK_SQL);
    assert.equal(app.prepare('SELECT COUNT(*) AS n FROM books').get().n, 2);
    assert.equal(app.prepare('SELECT COUNT(*) AS n FROM chapters').get().n, 1);
    assert.equal(app.prepare('SELECT COUNT(*) AS n FROM bookmarks').get().n, 1);
    assert.equal(app.prepare('SELECT offset FROM progress').get().offset, 432);
    app.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
