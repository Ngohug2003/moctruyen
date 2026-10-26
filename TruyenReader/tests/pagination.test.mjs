import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SCHEMA, fold } from '../src/domain/book-format.ts';
import { chapterPageQuery } from '../src/domain/chapter-query.ts';
import { createContentCache } from '../src/domain/content-cache.ts';
import { createBundle } from '../scripts/content/prepare-book.mjs';
import { verifyBundle } from '../scripts/content/verify-bundle.mjs';
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  const stmt = db.prepare('INSERT INTO chapters VALUES (?,?,?,?,?,?,?,?)');
  for (let i = 0; i < 123; i++) {
    const title = `Chương ${Math.floor(i / 2) + 1}: Đường về${i === 80 ? ' 100%_thử' : ''}`;
    stmt.run(`id-${i}`, 'book', i, Math.floor(i / 2) + 1, title, 'Nội dung', '', fold(title));
  }
  db.prepare('INSERT INTO bookmarks VALUES (?,?,?)').run('book', 'id-100', 'now');
  return db;
}
function page(db, query = '', marked = false, p = 0) {
  const sql = chapterPageQuery('book', query, marked, p);
  return {
    rows: db.prepare(sql.rowsSQL).all(...sql.rowArgs),
    total: db.prepare(sql.countSQL).get(...sql.countArgs).total,
  };
}
test('SQL pages return at most 50 metadata rows with no skipped or repeated parts', () => {
  const db = fixture();
  try {
    const a = page(db),
      b = page(db, '', false, 1),
      c = page(db, '', false, 2);
    assert.deepEqual([a.rows.length, b.rows.length, c.rows.length], [50, 50, 23]);
    assert.equal(a.total, 123);
    assert.equal(b.rows[0].position, 50);
    assert.equal(c.rows.at(-1).position, 122);
    assert.equal(new Set([...a.rows, ...b.rows, ...c.rows].map((c) => c.id)).size, 123);
    assert.ok(a.rows.every((c) => !Object.hasOwn(c, 'content')));
  } finally {
    db.close();
  }
});
test('SQL search finds both duplicate-number parts and handles accent folding/literal wildcards', () => {
  const db = fixture();
  try {
    assert.equal(page(db, '26').rows.length, 2);
    assert.deepEqual(
      page(db, '26').rows.map((c) => c.position),
      [50, 51],
    );
    assert.equal(page(db, 'duong ve').total, 123);
    assert.equal(page(db, '100%_thử').total, 1);
    assert.equal(page(db, "' OR 1=1 --").total, 0);
    assert.equal(page(db, '', true).rows[0].id, 'id-100');
  } finally {
    db.close();
  }
});
test('neighbor query crosses page boundaries and preserves duplicate-number order', () => {
  const db = fixture();
  try {
    const next = db.prepare(
      'SELECT id FROM chapters WHERE book_id=? AND position>? ORDER BY position ASC LIMIT 1',
    );
    assert.equal(next.get('book', 49).id, 'id-50');
    assert.equal(next.get('book', 50).id, 'id-51');
    assert.equal(next.get('book', 122), undefined);
  } finally {
    db.close();
  }
});
test('lazy content cache shares requests, stays bounded and retries failures', async () => {
  const calls = [];
  let fail = true;
  const cache = createContentCache(async (n) => {
    calls.push(n);
    if (n === 4 && fail) {
      fail = false;
      throw new Error('Mạng gián đoạn');
    }
    await new Promise((r) => setTimeout(r, 5));
    return [{ id: `id-${n}`, content: `Nội dung ${n}` }];
  }, 2);
  assert.deepEqual(await Promise.all([cache.get(0, 'id-0'), cache.get(0, 'id-0')]), [
    'Nội dung 0',
    'Nội dung 0',
  ]);
  assert.equal(calls.length, 1);
  await cache.get(1, 'id-1');
  await cache.get(0, 'id-0');
  await cache.get(2, 'id-2');
  assert.equal(cache.size, 2);
  await cache.get(1, 'id-1');
  assert.equal(calls.filter((x) => x === 1).length, 2);
  await assert.rejects(cache.get(4, 'id-4'));
  assert.equal(await cache.get(4, 'id-4'), 'Nội dung 4');
  await assert.rejects(cache.get(4, 'wrong-id'), /đúng phần/);
});
test('split bundle stores empty content in catalog and all text once in 50-item chunks', () => {
  const root = mkdtempSync(join(tmpdir(), 'moc-chunks-'));
  try {
    const input = join(root, 'truyen.json');
    const rows = Array.from({ length: 123 }, (_, i) => ({
      ten_truyen: 'Truyện phân trang',
      so_chuong: Math.floor(i / 2) + 1,
      ten_chuong: `Chương ${i}: Phần ${i}`,
      noi_dung: 'Nội dung ' + i + '\n\n' + 'Văn bản thử. '.repeat(100),
      url: `https://example.org/${i}`,
    }));
    writeFileSync(input, JSON.stringify(rows));
    const meta = createBundle(input, join(root, 'assets'));
    const sql = new DatabaseSync(join(root, 'assets', 'catalog.db'), { readOnly: true });
    const ids = sql.prepare('SELECT id,position FROM chapters ORDER BY position').all();
    assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM chapters WHERE content<>''").get().n, 0);
    sql.close();
    assert.deepEqual(
      meta.chunks.map((c) => c.count),
      [50, 50, 23],
    );
    const texts = meta.chunks.flatMap((c) =>
      JSON.parse(readFileSync(join(root, 'assets', c.file), 'utf8')),
    );
    assert.equal(texts.length, rows.length);
    for (let i = 0; i < rows.length; i++) {
      assert.equal(texts[i].id, ids[i].id);
      assert.equal(texts[i].content, rows[i].noi_dung.trim());
    }
    assert.equal(verifyBundle(root).count, 123);
    const first = join(root, 'assets', meta.chunks[0].file);
    writeFileSync(first, '[]');
    assert.throws(() => verifyBundle(root), /không khớp/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
