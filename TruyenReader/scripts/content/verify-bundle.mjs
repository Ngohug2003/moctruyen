import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export function verifyBundle(root, requireReal = true) {
  const file = resolve(root, 'assets/catalog.db');
  const metadata = resolve(root, 'assets/book-meta.json');
  if (!existsSync(file) || !existsSync(metadata))
    throw new Error('Thiếu database truyện. Chạy npm run prepare:book trước khi build.');
  const meta = JSON.parse(readFileSync(metadata, 'utf8'));
  if (requireReal && meta.demo)
    throw new Error('Đang là truyện mẫu. Chép truyen.json vào input rồi chạy BUILD_APK.bat.');
  const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (digest !== meta.databaseHash)
    throw new Error('Database không khớp thông tin truyện. Chạy lại bước chuẩn bị dữ liệu.');
  if (
    meta.format !== 'chunks-v1' ||
    meta.chunkSize !== 50 ||
    !Array.isArray(meta.chunks) ||
    meta.chunks.length !== Math.ceil(meta.count / meta.chunkSize)
  )
    throw new Error('Dữ liệu chưa có định dạng phân trang. Chạy npm run prepare:book.');
  let contentCount = 0;
  for (const chunk of meta.chunks) {
    if (!/^content\/chunk-\d+-[a-f0-9]+\.book$/.test(chunk.file))
      throw new Error('Đường dẫn cụm nội dung không hợp lệ.');
    const content = resolve(root, 'assets', chunk.file);
    if (!existsSync(content)) throw new Error('Thiếu cụm nội dung: ' + chunk.file);
    const bytes = readFileSync(content);
    if (createHash('sha256').update(bytes).digest('hex') !== chunk.hash)
      throw new Error('Cụm nội dung không khớp: ' + chunk.file);
    contentCount += chunk.count;
  }
  if (contentCount !== meta.count) throw new Error('Số mục trong các cụm không khớp mục lục.');
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const check = db.prepare('PRAGMA quick_check').get();
    if (check.quick_check !== 'ok') throw new Error('Database truyện không toàn vẹn.');
    const book = db.prepare('SELECT id,title,total FROM books WHERE id=?').get(meta.bookId);
    const count = db
      .prepare('SELECT COUNT(*) AS total FROM chapters WHERE book_id=?')
      .get(meta.bookId);
    if (
      !book ||
      book.total !== meta.count ||
      count.total !== meta.count ||
      book.title !== meta.title
    )
      throw new Error('Số chương hoặc tên truyện trong database không khớp.');
    if (meta.count < 1) throw new Error('Truyện chưa có nội dung.');
  } finally {
    db.close();
  }
  return meta;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const meta = verifyBundle(root, !process.argv.includes('--allow-demo'));
    console.log(`Đã kiểm tra database: ${meta.title} / ${meta.count.toLocaleString('vi-VN')} mục.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
