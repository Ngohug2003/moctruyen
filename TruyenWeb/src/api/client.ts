export type Account = { id: string; email: string; name: string };
export type RemoteProgress = {
  book_id: string;
  chapter_id: string;
  title: string;
  position: number;
  version: string;
  ratio: number;
  pixel: number;
  location_kind: 'ratio' | 'pixel';
  revision: number;
  updated_at: string;
};
type Update = {
  chapter_id: string;
  version: string;
  location_kind: 'ratio' | 'pixel';
  location_value: number;
  expected_revision: number;
};
type Storage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
};
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function createCloud(storage: Storage, credentials: Storage, defaultUrl: string) {
  let baseUrl = defaultUrl;
  let session: { token: string; user: Account } | null = null;
  let revision: Record<string, number> = {};
  let pending: Record<string, Update> = {};
  let running: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let message = '';
  const listeners = new Set<() => void>();
  const receivers = new Set<(rows: RemoteProgress[]) => void | Promise<void>>();
  const emit = () => listeners.forEach((fn) => fn());
  const persist = () =>
    session
      ? storage.set('moc-sync-' + session.user.id, JSON.stringify({ revision, pending }))
      : Promise.resolve();
  async function request<T>(
    path: string,
    body?: unknown,
    method = 'GET',
    timeoutMs = 10000,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    try {
      const response = await fetch(baseUrl + '/api/v1' + path, {
        method,
        signal: controller.signal,
        headers: {
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
          ...(session ? { Authorization: 'Bearer ' + session.token } : {}),
        },
        ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
      });
      let json: { data?: T; message?: string } | null = null;
      try {
        json = await response.json();
      } catch {
        // Non-JSON response (e.g. HTML error from reverse proxy)
      }

      if (!response.ok) {
        if (response.status === 413)
          throw new ApiError(
            413,
            'File quá lớn, vượt quá giới hạn tải lên của máy chủ (tối đa 250MB).',
          );
        if (response.status === 401)
          throw new ApiError(401, json?.message || 'Vui lòng đăng nhập để thực hiện thao tác này.');
        throw new ApiError(response.status, json?.message || `Lỗi máy chủ (${response.status}).`);
      }

      if (!json)
        throw new ApiError(response.status, 'Phản hồi từ máy chủ không đúng định dạng JSON.');

      return json.data as T;
    } finally {
      clearTimeout(timeout);
    }
  }
  async function pull() {
    const rows: RemoteProgress[] = [];
    for (let page = 1; ; page++) {
      const result = await request<{ items: RemoteProgress[]; total: number }>(
        '/reader/progress?page_size=100&page=' + page,
      );
      rows.push(...result.items);
      if (rows.length >= result.total) break;
    }
    for (const row of rows) revision[row.book_id] = row.revision;
    await Promise.all([...receivers].map((fn) => fn(rows.filter((row) => !pending[row.book_id]))));
    await persist();
  }
  async function sync() {
    clearTimeout(timer);
    if (!session) return;
    if (running) return running;
    running = (async () => {
      let conflict = false;
      try {
        for (const [bookId, update] of Object.entries(pending)) {
          try {
            const result = await request<RemoteProgress>(
              '/reader/progress/' + bookId,
              update,
              'PUT',
            );
            revision[bookId] = result.revision;
            if (pending[bookId] === update) delete pending[bookId];
            else if (pending[bookId]) pending[bookId].expected_revision = result.revision;
          } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
              delete pending[bookId];
              conflict = true;
            } else throw error;
          }
          await persist();
        }
        await pull();
        message = conflict
          ? 'Thiết bị khác đã cập nhật. Đã lấy tiến độ mới từ máy chủ.'
          : 'Đã đồng bộ tiến độ';
      } catch (error) {
        message =
          error instanceof ApiError && error.status === 401
            ? 'Phiên hết hạn. Hãy đăng nhập lại; tiến độ vẫn lưu trên máy.'
            : 'Chưa kết nối máy chủ; tiến độ được giữ trên thiết bị để thử lại.';
      } finally {
        running = null;
        emit();
      }
    })();
    return running;
  }
  async function init() {
    baseUrl = (await storage.get('moc-api-url')) || defaultUrl;
    try {
      session = JSON.parse((await credentials.get('moc-session')) || 'null');
    } catch {
      session = null;
    }
    if (session) {
      const cached = JSON.parse((await storage.get('moc-sync-' + session.user.id)) || '{}');
      revision = cached.revision || {};
      pending = cached.pending || {};
    }
    emit();
  }
  async function login(email: string, password: string, name?: string) {
    if (running) await running;
    const result = await request<{ token: string; user: Account }>(
      name === undefined ? '/auth/login' : '/auth/register',
      { email, password, ...(name === undefined ? {} : { name }) },
      'POST',
    );
    session = result;
    await credentials.set('moc-session', JSON.stringify(session));
    const cached = JSON.parse((await storage.get('moc-sync-' + session.user.id)) || '{}');
    revision = cached.revision || {};
    pending = cached.pending || {};
    emit();
  }
  async function logout() {
    if (running) await running;
    await sync();
    // Keep the session if revocation fails so logout never falsely claims revocation.
    await request('/auth/logout', {}, 'POST');
    session = null;
    revision = {};
    pending = {};
    message = '';
    await credentials.set('moc-session', 'null');
    emit();
  }
  return {
    init,
    login,
    logout,
    sync,
    request,
    get user() {
      return session?.user || null;
    },
    get message() {
      return message;
    },
    get url() {
      return baseUrl;
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    receive(fn: (rows: RemoteProgress[]) => void | Promise<void>) {
      receivers.add(fn);
      return () => {
        receivers.delete(fn);
      };
    },
    async setUrl(url: string) {
      if (session) throw new Error('Đăng xuất trước khi đổi máy chủ.');
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol))
        throw new Error('Địa chỉ API phải dùng http hoặc https.');
      baseUrl = url.replace(/\/$/, '');
      await storage.set('moc-api-url', baseUrl);
    },
    async queue(bookId: string, update: Omit<Update, 'expected_revision'>) {
      if (!session) return;
      pending[bookId] = {
        ...update,
        expected_revision: pending[bookId]?.expected_revision ?? revision[bookId] ?? 0,
      };
      await persist();
      clearTimeout(timer);
      timer = setTimeout(() => {
        void sync();
      }, 1500);
    },
  };
}
