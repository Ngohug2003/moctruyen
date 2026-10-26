import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA, fold, stableId } from '../src/domain/book-format.ts';
import { REMOVE_LEGACY_SAMPLE_SQL } from '../src/domain/library-cleanup.ts';

function addBook(db, title, total, source = '') {
  const id = stableId(fold(title));
  db.prepare('INSERT INTO books VALUES (?,?,?,?,?)').run(id, title, total, source, 'now');
  db.prepare('INSERT INTO chapters VALUES (?,?,?,?,?,?,?,?)').run(
    'chapter',
    id,
    0,
    1,
    'Chương 1',
    'Nội dung',
    source,
    'chuong 1',
  );
  db.prepare('INSERT INTO progress VALUES (?,?,?,?)').run(id, 'chapter', 458, 'now');
  db.prepare('INSERT INTO bookmarks VALUES (?,?,?)').run(id, 'chapter', 'now');
  return id;
}

test('xóa riêng mẫu cũ và dữ liệu liên quan, giữ truyện thật / tiến độ / cài đặt; chạy lại an toàn', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(SCHEMA);
    const sample = addBook(db, 'Một khoảng bình yên', 3);
    const real = addBook(db, 'Đế Bá', 3276, 'https://example.org/de-ba');
    const other = addBook(db, 'Truyện đã nhập', 20);
    db.prepare('INSERT INTO settings VALUES (?,?)').run('reader', '{"theme":"night"}');
    const tables = ['books', 'chapters', 'progress', 'bookmarks', 'settings'];
    db.exec('BEGIN');
    db.exec(REMOVE_LEGACY_SAMPLE_SQL);
    db.exec('COMMIT');
    for (const table of tables.slice(0, 4)) {
      const column = table === 'books' ? 'id' : 'book_id';
      assert.equal(
        db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`).get(sample).n,
        0,
      );
      for (const id of [real, other])
        assert.equal(
          db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`).get(id).n,
          1,
        );
    }
    assert.equal(db.prepare('SELECT offset FROM progress WHERE book_id=?').get(real).offset, 458);
    assert.equal(
      db.prepare('SELECT value FROM settings WHERE key=?').get('reader').value,
      '{"theme":"night"}',
    );
    const snapshot = tables.map((table) => db.prepare(`SELECT * FROM ${table}`).all());
    db.exec(REMOVE_LEGACY_SAMPLE_SQL);
    assert.deepEqual(
      tables.map((table) => db.prepare(`SELECT * FROM ${table}`).all()),
      snapshot,
    );
  } finally {
    db.close();
  }
});

test('không xóa truyện trùng tên có nguồn thật hoặc số chương khác mẫu', () => {
  for (const [total, source] of [
    [3, 'https://example.org/book'],
    [100, ''],
  ]) {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(SCHEMA);
      const id = addBook(db, 'Một khoảng bình yên', total, source);
      db.exec(REMOVE_LEGACY_SAMPLE_SQL);
      assert.equal(db.prepare('SELECT total FROM books WHERE id=?').get(id).total, total);
      assert.equal(db.prepare('SELECT offset FROM progress WHERE book_id=?').get(id).offset, 458);
    } finally {
      db.close();
    }
  }
});
