import fallback from '../../assets/knowledge/de-ba.json';
import { cloud } from '../api/cloud';
import type { CultivationGuide } from '../domain/cultivation';
import { readLocalFirst } from '../domain/read-source';
export async function loadCultivation(
  bookId: string,
): Promise<{ guide: CultivationGuide; offline: boolean }> {
  return readLocalFirst<{ guide: CultivationGuide; offline: boolean }>(
    async () => {
      if (fallback.book_id !== bookId) throw new Error('Truyện này chưa có bảng cảnh giới.');
      return { guide: fallback as CultivationGuide, offline: true };
    },
    async () => ({
      guide: await cloud.request<CultivationGuide>(
        `/public/books/${bookId}/cultivation`,
        undefined,
        'GET',
        1500,
      ),
      offline: false,
    }),
  );
}
