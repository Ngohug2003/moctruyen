import { cloud } from '../api/cloud';
import type { CultivationGuide } from '../domain/cultivation';
import { readLocalFirst } from '../domain/read-source';
export async function loadCultivation(
  bookId: string,
): Promise<{ guide: CultivationGuide; offline: boolean }> {
  return readLocalFirst<{ guide: CultivationGuide; offline: boolean }>(
    async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}knowledge/de-ba.json`);
      if (!response.ok) throw new Error('Chưa tải được bảng cảnh giới.');
      const guide: CultivationGuide = await response.json();
      if (guide.book_id !== bookId) throw new Error('Truyện này chưa có bảng cảnh giới.');
      return { guide, offline: true };
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
