import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadCultivation } from '../../data/cultivation';
import { fold } from '../../domain/book-utils';
import type { CultivationSource, CultivationGuide as Guide } from '../../domain/cultivation';
import { hasCultivationGuide } from '../../domain/cultivation';
import { Loading, Modal } from '../../ui/primitives';

export function CultivationButton({ bookId }: { bookId: string }) {
  const [open, setOpen] = useState(false);
  if (!hasCultivationGuide(bookId)) return null;
  return (
    <>
      <button className="button secondary cultivation-trigger" onClick={() => setOpen(true)}>
        <Sparkles size={17} />
        Cảnh giới
      </button>
      {open && <CultivationDialog bookId={bookId} onClose={() => setOpen(false)} />}
    </>
  );
}
function CultivationDialog({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const [result, setResult] = useState<{ guide: Guide; offline: boolean }>();
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadCultivation(bookId)
      .then((value) => {
        if (active) {
          setResult(value);
          setSelected(value.guide.systems[0]?.id || '');
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [bookId, attempt]);
  const system = result?.guide.systems.find((s) => s.id === selected);
  const needle = fold(query.trim());
  const entries =
    system?.realms.filter((realm) =>
      fold([realm.name, ...realm.aliases, realm.branch, realm.detail].join(' ')).includes(needle),
    ) || [];
  function sources(ids: string[]): CultivationSource[] {
    return result?.guide.sources.filter((source) => ids.includes(source.id)) || [];
  }
  return (
    <Modal title="Cảnh giới Đế Bá" onClose={onClose} drawer>
      <div className="cultivation-guide">
        {!result && !error && <Loading text="Đang mở bảng cảnh giới…" />}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button className="button secondary" onClick={() => setAttempt((n) => n + 1)}>
              Thử lại
            </button>
          </div>
        )}
        {result && (
          <>
            <p className="muted">{result.guide.intro}</p>
            <span className="cultivation-status">
              {result.offline ? 'Bản lưu ngoại tuyến' : 'Đã tải từ thư viện'} · Cập nhật{' '}
              {result.guide.updated_at}
            </span>
            <label className="field-label" htmlFor="realm-world">
              GIỚI VỰC
            </label>
            <select
              id="realm-world"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setQuery('');
              }}
            >
              {result.guide.systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <input
              className="cultivation-search"
              aria-label="Tìm cảnh giới"
              placeholder="Tìm cảnh giới, tên khác, nhánh…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {system && (
              <section>
                <h3>{system.title}</h3>
                <span className="cultivation-status">{system.verification}</span>
                <p>{system.summary}</p>
                <ol className="realm-list">
                  {entries.map((realm) => (
                    <li className="realm-card" key={realm.id}>
                      <span className="eyebrow">{realm.branch}</span>
                      <h4>{realm.name}</h4>
                      {realm.aliases.length > 0 && (
                        <p className="muted">Tên khác: {realm.aliases.join(' · ')}</p>
                      )}
                      {realm.detail && <p>{realm.detail}</p>}
                      <div className="realm-sources">
                        {sources(realm.source_ids).map((source) => (
                          <a
                            key={source.id}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {source.kind === 'novel' ? source.title : 'Bài tham khảo'}
                          </a>
                        ))}
                      </div>
                    </li>
                  ))}
                </ol>
                {!entries.length && <p role="status">Không tìm thấy cảnh giới phù hợp.</p>}
              </section>
            )}
            <details className="cultivation-provenance">
              <summary>Nguồn và cách đối chiếu</summary>
              <p>{result.guide.source_note}</p>
              {result.guide.sources.map((source) => (
                <p key={source.id}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.title}
                  </a>
                </p>
              ))}
            </details>
          </>
        )}
      </div>
    </Modal>
  );
}
