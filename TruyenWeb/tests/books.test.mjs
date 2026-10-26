import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchChapters, pageItems, safeRatio, validPosition } from '../src/domain/book-utils.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => JSON.parse(readFileSync(resolve(root, 'public', path), 'utf8'));

test('tìm không dấu và số chương chính xác, giữ mọi phần trùng số', () => {
  const items = [
    { id: 'a', number: 11, position: 0, title: 'Chương 11: Đế Bá' },
    { id: 'b', number: 11, position: 1, title: 'Chương 11: Đế Bá (phần 2)' },
    { id: 'c', number: 111, position: 2, title: 'Chương 111: Khởi đầu' },
  ];
  assert.deepEqual(
    searchChapters(items, '11').map((item) => item.id),
    ['a', 'b'],
  );
  assert.equal(searchChapters(items, 'de ba').length, 2);
  assert.equal(searchChapters(items, 'KHỞI ĐẦU')[0].id, 'c');
  assert.equal(searchChapters(items, '%').length, 0);
});

test('phân trang không bỏ/trùng mục và giới hạn vị trí đọc', () => {
  const items = Array.from({ length: 6899 }, (_, index) => index);
  assert.deepEqual(
    Array.from({ length: 138 }, (_, index) => pageItems(items, index)).flat(),
    items,
  );
  assert.equal(safeRatio(Number.NaN), 0);
  assert.equal(safeRatio(2), 1);
  assert.equal(validPosition(-1, 100), false);
  assert.equal(validPosition('abc', 100), false);
  assert.equal(validPosition(100, 100), false);
  assert.equal(validPosition(99, 100), true);
});

test('dữ liệu web thật có đủ mục, mỗi trang tối đa 50, nội dung đầu/cuối khớp mã chương', () => {
  const books = read('books/index.json');
  assert.ok(books.length > 0);
  for (const book of books) {
    const all = [];
    for (let page = 0; page < book.pageCount; page++) {
      const rows = read(`${book.basePath}/toc-${page}.json`);
      assert.ok(rows.length <= 50);
      all.push(...rows);
    }
    assert.equal(all.length, book.total);
    assert.equal(new Set(all.map((item) => item.id)).size, book.total);
    assert.deepEqual(
      all.map((item) => item.position),
      Array.from({ length: book.total }, (_, i) => i),
    );
    for (const page of [0, book.pageCount - 1]) {
      const metadata = read(`${book.basePath}/toc-${page}.json`);
      const content = read(`${book.basePath}/${book.chunks[page]}`);
      assert.deepEqual(
        content.map((item) => item.id),
        metadata.map((item) => item.id),
      );
      assert.ok(content.every((item) => item.content.trim().length > 0));
    }
  }
});
