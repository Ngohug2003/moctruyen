import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  statSync,
  readdirSync,
} from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBookText } from '../../TruyenReader/src/domain/book-format.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = resolve(root, '../TruyenReader');
const output = resolve(root, 'public/books');
const pageSize = 50;
const write = (path, data) => writeFileSync(path, JSON.stringify(data));

export function publishBook(destination, book, chapters, copyContent) {
  const basePath = `books/${book.id}/${book.version}`;
  const folder = resolve(destination, book.id, book.version);
  mkdirSync(folder, { recursive: true });
  const result = { ...book, basePath, pageSize, pageCount: Math.ceil(chapters.length / pageSize) };
  for (let start = 0; start < chapters.length; start += pageSize)
    write(resolve(folder, `toc-${start / pageSize}.json`), chapters.slice(start, start + pageSize));
  write(resolve(folder, 'search.json'), chapters);
  copyContent(folder);
  return result;
}

export function prepareBooks() {
  mkdirSync(output, { recursive: true });
  const books = new Map();
  const metaFile = resolve(app, 'assets/book-meta.json');
  const catalogDbFile = resolve(app, 'assets/catalog.db');
  if (existsSync(metaFile) && existsSync(catalogDbFile)) {
    try {
      const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
      if (!meta.demo) {
        const db = new DatabaseSync(catalogDbFile, { readOnly: true });
        let chapters;
        try {
          chapters = db
            .prepare(
              'SELECT id,position,number,title FROM chapters WHERE book_id=? ORDER BY position',
            )
            .all(meta.bookId);
        } finally {
          db.close();
        }
        if (chapters.length === meta.count && meta.chunkSize === pageSize) {
          const book = publishBook(
            output,
            {
              id: meta.bookId,
              title: meta.title,
              total: meta.count,
              version: meta.hash,
              chunks: meta.chunks.map((chunk) => basename(chunk.file)),
            },
            chapters,
            (folder) => {
              for (const chunk of meta.chunks) {
                const destination = resolve(folder, basename(chunk.file));
                const chunkSource = resolve(app, 'assets', chunk.file);
                if (existsSync(chunkSource)) {
                  if (!existsSync(destination) || statSync(destination).size !== chunk.bytes)
                    copyFileSync(chunkSource, destination);
                }
              }
            },
          );
          books.set(book.id, book);
        }
      }
    } catch (err) {
      console.warn('Bỏ qua đóng gói từ TruyenReader:', err.message);
    }
  }
  const input = resolve(root, 'input');
  mkdirSync(input, { recursive: true });
  for (const name of readdirSync(input)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort()) {
    const text = readFileSync(resolve(input, name), 'utf8');
    const parsed = parseBookText(text);
    const version = createHash('sha256').update(text).digest('hex').slice(0, 20);
    const chapters = parsed.chapters.map(({ id, position, number, title }) => ({
      id,
      position,
      number,
      title,
    }));
    const chunks = [];
    for (let i = 0; i < chapters.length; i += pageSize) chunks.push(`content-${i / pageSize}.json`);
    const book = publishBook(
      output,
      { id: parsed.id, title: parsed.title, total: chapters.length, version, chunks },
      chapters,
      (folder) => {
        for (let start = 0; start < parsed.chapters.length; start += pageSize)
          write(
            resolve(folder, chunks[start / pageSize]),
            parsed.chapters
              .slice(start, start + pageSize)
              .map(({ id, content }) => ({ id, content })),
          );
      },
    );
    books.set(book.id, book);
  }
  // Commit the library index last; each immutable version remains available to open tabs.
  const library = [...books.values()];
  write(resolve(output, 'index.json'), library);
  if (library.length > 0) {
    console.log(
      `Thư viện web: ${library.map((book) => `${book.title} (${book.total.toLocaleString('vi-VN')} mục)`).join(', ')}`,
    );
  } else {
    console.log(
      'Thư viện web: Không có truyện tĩnh đóng gói sẵn; web sẽ tải danh mục và chương trực tuyến qua API http://3.104.65.209:8000.',
    );
  }
  return library;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    prepareBooks();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

// Refresh the packaged reference data; never fetch or parse web pages during builds.
const knowledgeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const knowledgeSource = resolve(knowledgeRoot, '../TruyenBackend/data/cultivation/de-ba.json');
if (existsSync(knowledgeSource)) {
  mkdirSync(resolve(knowledgeRoot, 'public/knowledge'), { recursive: true });
  copyFileSync(knowledgeSource, resolve(knowledgeRoot, 'public/knowledge/de-ba.json'));
}
