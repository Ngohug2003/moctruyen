import { fold, stableId } from './book-format.ts';

// Match the retired sample precisely; never clear the user's library or settings.
const legacySample = `SELECT id FROM books
  WHERE id='${stableId(fold('Một khoảng bình yên'))}'
    AND title='Một khoảng bình yên' AND source='' AND total=3`;

export const REMOVE_LEGACY_SAMPLE_SQL = `
DELETE FROM bookmarks WHERE book_id IN (${legacySample});
DELETE FROM progress WHERE book_id IN (${legacySample});
DELETE FROM chapters WHERE book_id IN (${legacySample});
DELETE FROM books WHERE id IN (${legacySample});
`;
