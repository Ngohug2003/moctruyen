type ContentRow = { id: string; content: string };
export function createContentCache(load: (index: number) => Promise<ContentRow[]>, capacity = 2) {
  const cache = new Map<number, Map<string, string>>();
  const pending = new Map<number, Promise<Map<string, string>>>();
  async function getChunk(index: number): Promise<Map<string, string>> {
    const found = cache.get(index);
    if (found) {
      cache.delete(index);
      cache.set(index, found);
      return found;
    }
    const active = pending.get(index);
    if (active) return active;
    const work = (async () => {
      const rows = await load(index);
      if (
        !Array.isArray(rows) ||
        rows.some(
          (r) =>
            !r || typeof r.id !== 'string' || typeof r.content !== 'string' || !r.content.trim(),
        )
      )
        throw new Error('Cụm nội dung chương không hợp lệ. Hãy chuẩn bị lại dữ liệu.');
      const chunk = new Map(rows.map((r) => [r.id, r.content]));
      cache.set(index, chunk);
      while (cache.size > capacity) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      return chunk;
    })();
    pending.set(index, work);
    try {
      return await work;
    } finally {
      pending.delete(index);
    }
  }
  return {
    async get(index: number, id: string): Promise<string> {
      const chunk = await getChunk(index);
      const content = chunk.get(id);
      if (content === undefined)
        throw new Error(
          'Không tìm thấy đúng phần chương trong cụm dữ liệu. Chạy lại npm start để cập nhật file truyện.',
        );
      return content;
    },
    get size() {
      return cache.size;
    },
  };
}
