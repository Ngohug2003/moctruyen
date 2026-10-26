import { cloud } from '../api/cloud';
import type { CultivationGuide } from '../domain/cultivation';
export async function loadCultivation(
  bookId: string,
): Promise<{ guide: CultivationGuide; offline: boolean }> {
  try {
    const guide = await cloud.request<CultivationGuide>(
      `/public/books/${bookId}/cultivation`,
      undefined,
      'GET',
      10000,
    );
    if (guide && guide.book_id === bookId) {
      return { guide, offline: false };
    }
  } catch {}

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}knowledge/de-ba.json`);
    if (response.ok) {
      const guide: CultivationGuide = await response.json();
      if (guide.book_id === bookId) return { guide, offline: true };
    }
  } catch {}

  throw new Error('Chưa tải được bảng cảnh giới.');
}
