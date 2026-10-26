import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileText,
  LoaderCircle,
  Plus,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { cloud } from '../../api/cloud';
import type { BookPreview, BookUploadResult } from '../../domain/types';
import { number } from '../../ui/format';
import { Modal } from '../../ui/primitives';

export function UploadBookModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<BookPreview | null>(null);
  const [result, setResult] = useState<BookUploadResult | null>(null);

  const isLoggedIn = !!cloud.user;

  async function handlePreview() {
    if (!file) {
      setError('Vui lòng chọn một file truyện (.txt hoặc .json).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title.trim()) {
        formData.append('title', title.trim());
      }

      const data = await cloud.request<BookPreview>(
        '/admin/books/preview',
        formData,
        'POST',
        60000,
      );
      setPreview(data);
      if (!title.trim() && data.title) {
        setTitle(data.title);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đọc xem trước file truyện.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmSave() {
    if (!file) return;
    setError('');
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim() || (preview ? preview.title : ''));
      formData.append('overwrite', String(overwrite));
      formData.append('export_chunks', 'true');

      const data = await cloud.request<BookUploadResult>(
        '/admin/books/upload',
        formData,
        'POST',
        120000,
      );
      setResult(data);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu truyện vào database.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Thêm truyện vào hệ thống" onClose={onClose} drawer>
      <div className="upload-book-modal">
        {!isLoggedIn && (
          <div className="inline-notice warning" role="alert">
            <AlertCircle size={18} />
            <span>
              Bạn chưa đăng nhập. Tính năng tải truyện yêu cầu đăng nhập tài khoản ở góc trên bên
              phải.
            </span>
          </div>
        )}

        {error && (
          <div className="inline-notice error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {result ? (
          <div className="upload-success-panel">
            <div className="success-icon">
              <CheckCircle2 size={44} color="#4b785a" />
            </div>
            <h3>Lưu truyện thành công!</h3>
            <p className="success-message">{result.message}</p>
            <div className="summary-meta">
              <div>
                <strong>Mã truyện:</strong> <code>{result.id}</code>
              </div>
              <div>
                <strong>Tên truyện:</strong> {result.title}
              </div>
              <div>
                <strong>Tổng số chương:</strong> {number(result.total)}
              </div>
              <div>
                <strong>Thời gian xử lý:</strong> {result.duration_seconds}s
              </div>
            </div>
            <div className="modal-actions">
              <button className="button primary" onClick={onClose}>
                Xem trong thư viện
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        ) : !preview ? (
          <div className="upload-step-select">
            <div className="form-group">
              <label htmlFor="book-file" className="form-label">
                <strong>1. Chọn file truyện (.txt hoặc .json)</strong>
              </label>
              <div className="file-input-wrapper">
                <input
                  id="book-file"
                  type="file"
                  accept=".txt,.json"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] || null;
                    setFile(selected);
                    setError('');
                  }}
                />
                {file && (
                  <div className="file-info">
                    <FileText size={18} />
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  </div>
                )}
              </div>
              <small className="help-text">
                Hỗ trợ file text có cấu trúc &ldquo;Thứ 1 chương...&rdquo;, &ldquo;Chương
                1...&rdquo; hoặc file JSON mảng chương crawl.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="book-title" className="form-label">
                <strong>2. Tên truyện (Tùy chọn)</strong>
              </label>
              <input
                id="book-title"
                className="text-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Để trống để tự động nhận diện từ file"
              />
            </div>

            <div className="modal-actions">
              <button className="button secondary" onClick={onClose} disabled={loading}>
                Đóng
              </button>
              <button
                className="button primary"
                onClick={handlePreview}
                disabled={!file || loading || !isLoggedIn}
              >
                {loading ? (
                  <>
                    <LoaderCircle className="spinner" size={17} />
                    Đang phân tích file…
                  </>
                ) : (
                  <>
                    <Eye size={17} />
                    Xem trước (Preview)
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="upload-step-preview">
            <div className="preview-summary-card">
              <div className="preview-title-row">
                <div className="form-group flex-1">
                  <label htmlFor="edit-title" className="form-label">
                    <strong>Tên truyện:</strong>
                  </label>
                  <input
                    id="edit-title"
                    className="text-input"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="preview-stats-badge">
                  <strong>{number(preview.total)}</strong>
                  <span>CHƯƠNG TÌM THẤY</span>
                </div>
              </div>

              <div className="preview-meta-row">
                <span>
                  Mã ID: <code>{preview.id}</code>
                </span>
                <span>Thời gian bóc tách: {preview.duration_seconds}s</span>
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                <span>Ghi đè nội dung nếu truyện đã tồn tại (Overwrite)</span>
              </label>
            </div>

            <div className="sample-chapters-section">
              <h4>Mẫu các chương đầu ({preview.first_chapters.length} chương):</h4>
              <div className="chapters-list">
                {preview.first_chapters.map((ch) => (
                  <div key={ch.position} className="chapter-preview-item">
                    <div className="chapter-preview-header">
                      <span className="chapter-pos">#{ch.position + 1}</span>
                      <strong className="chapter-title">{ch.title}</strong>
                    </div>
                    <p className="chapter-excerpt">{ch.excerpt}</p>
                  </div>
                ))}
              </div>

              {preview.last_chapters.length > 0 && (
                <>
                  <div className="chapters-divider">
                    <span>
                      …{' '}
                      {number(
                        preview.total -
                          preview.first_chapters.length -
                          preview.last_chapters.length,
                      )}{' '}
                      chương ở giữa …
                    </span>
                  </div>
                  <h4>Mẫu các chương cuối:</h4>
                  <div className="chapters-list">
                    {preview.last_chapters.map((ch) => (
                      <div key={ch.position} className="chapter-preview-item">
                        <div className="chapter-preview-header">
                          <span className="chapter-pos">#{ch.position + 1}</span>
                          <strong className="chapter-title">{ch.title}</strong>
                        </div>
                        <p className="chapter-excerpt">{ch.excerpt}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => setPreview(null)}
                disabled={saving}
              >
                <RefreshCw size={16} />
                Chọn lại file
              </button>
              <button
                className="button primary"
                onClick={handleConfirmSave}
                disabled={saving || !isLoggedIn}
              >
                {saving ? (
                  <>
                    <LoaderCircle className="spinner" size={17} />
                    Đang lưu vào database…
                  </>
                ) : (
                  <>
                    <Upload size={17} />
                    Xác nhận Lưu vào DB
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function UploadBookButton({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="button primary add-book-button" onClick={() => setOpen(true)}>
        <Plus size={17} />
        Thêm truyện
      </button>
      {open && (
        <UploadBookModal
          onClose={() => setOpen(false)}
          onSuccess={() => {
            onSaved?.();
          }}
        />
      )}
    </>
  );
}
