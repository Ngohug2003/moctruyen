import { fold } from './book-format.ts';
export const CHAPTER_PAGE_SIZE = 50;
export function chapterPageQuery(bookId: string, query: string, markedOnly: boolean, page: number) {
  const text = fold(query.trim());
  const args: (string | number)[] = [bookId];
  let where = 'c.book_id=?';
  if (markedOnly) where += ' AND m.chapter_id IS NOT NULL';
  if (text) {
    if (/^\d+$/.test(text)) {
      where += ' AND c.number=?';
      args.push(Number(text));
    } else {
      where += " AND c.search_title LIKE ? ESCAPE '\\'";
      args.push('%' + text.replace(/[\\%_]/g, '\\$&') + '%');
    }
  }
  const join =
    'FROM chapters c LEFT JOIN bookmarks m ON m.book_id=c.book_id AND m.chapter_id=c.id WHERE ' +
    where;
  return {
    countSQL: 'SELECT COUNT(*) AS total ' + join,
    rowsSQL:
      'SELECT c.id,c.position,c.number,c.title,CASE WHEN m.chapter_id IS NULL THEN 0 ELSE 1 END AS marked ' +
      join +
      ' ORDER BY c.position LIMIT ? OFFSET ?',
    countArgs: args,
    rowArgs: [...args, CHAPTER_PAGE_SIZE, Math.max(0, Math.floor(page)) * CHAPTER_PAGE_SIZE],
  };
}
