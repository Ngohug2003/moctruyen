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
        180000,
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
        240000,
      );
      setResult(data);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu truyện vào hệ thống.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Thêm truyện vào thư viện" onClose={onClose} drawer={false}>
      <div className="upload-modal-container">
        {!isLoggedIn && (
          <div className="upload-alert-warning" role="alert">
            <AlertCircle size={20} className="alert-icon" />
            <div>
              <strong>Lưu ý:</strong> Bạn cần đăng nhập tài khoản trước khi tải truyện (dùng nút ở
              góc trên bên phải màn hình).
            </div>
          </div>
        )}

        {error && (
          <div className="upload-alert-error" role="alert">
            <AlertCircle size={20} className="alert-icon" />
            <div>{error}</div>
          </div>
        )}

        {result ? (
          <div className="upload-success-container">
            <div className="success-badge-icon">
              <CheckCircle2 size={52} />
            </div>
            <h3 className="success-heading">Đã lưu truyện thành công!</h3>
            <p className="success-subheading">
              Truyện đã được cập nhật vào danh mục thư viện và sẵn sàng để bạn đọc ngay.
            </p>

            <div className="success-meta-card">
              <div className="meta-row">
                <span className="meta-label">Tên truyện:</span>
                <strong className="meta-value">{result.title}</strong>
              </div>
              <div className="meta-row">
                <span className="meta-label">Tổng số chương:</span>
                <span className="meta-value highlight">{number(result.total)} chương</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Mã định danh:</span>
                <code className="meta-code">{result.id}</code>
              </div>
              <div className="meta-row">
                <span className="meta-label">Thời gian lưu:</span>
                <span className="meta-value">{result.duration_seconds} giây</span>
              </div>
            </div>

            <div className="modal-footer-actions">
              <button
                className="button primary btn-large"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
              >
                Mở Thư viện đọc ngay
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : !preview ? (
          <div className="upload-step-body">
            <p className="step-intro-text">
              Chọn file truyện (.txt hoặc .json) để hệ thống tự động bóc tách chương, chuẩn hóa nội
              dung và hiển thị bản xem trước cho bạn kiểm tra.
            </p>

            <div className="form-field-group">
              <label className="field-label" htmlFor="novel-file-input">
                1. File tiểu thuyết nguồn (.txt hoặc .json)
              </label>

              <div
                className={`dropzone-card ${file ? 'has-file' : ''}`}
                onClick={() => document.getElementById('novel-file-input')?.click()}
              >
                <input
                  id="novel-file-input"
                  type="file"
                  accept=".txt,.json"
                  className="hidden-file-input"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] || null;
                    setFile(selected);
                    setError('');
                  }}
                />

                {file ? (
                  <div className="selected-file-display">
                    <FileText size={32} className="file-svg-icon" />
                    <div className="file-details">
                      <span className="file-title-text">{file.name}</span>
                      <span className="file-size-badge">
                        Dung lượng: {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                    <span className="change-file-pill">Bấm để đổi file khác</span>
                  </div>
                ) : (
                  <div className="empty-dropzone-prompt">
                    <Upload size={36} className="upload-svg-icon" />
                    <span className="prompt-primary">Bấm vào đây để chọn file từ máy tính</span>
                    <span className="prompt-secondary">
                      Hỗ trợ file text phân chương hoặc file JSON crawl (tối đa 250MB)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="form-field-group">
              <label className="field-label" htmlFor="novel-custom-title">
                2. Tên truyện (Tùy chọn)
              </label>
              <input
                id="novel-custom-title"
                className="custom-text-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Để trống nếu muốn tự động lấy tên từ file"
              />
              <span className="field-hint">
                Nếu để trống, hệ thống sẽ tự động trích xuất tên truyện từ tiêu đề bên trong file.
              </span>
            </div>

            <div className="modal-footer-actions">
              <button className="button secondary" onClick={onClose} disabled={loading}>
                Đóng
              </button>
              <button
                className="button primary btn-highlight"
                onClick={handlePreview}
                disabled={!file || loading || !isLoggedIn}
              >
                {loading ? (
                  <>
                    <LoaderCircle className="spinner" size={18} />
                    Đang bóc tách & phân tích file…
                  </>
                ) : (
                  <>
                    <Eye size={18} />
                    Xem trước (Preview)
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="upload-step-body">
            <div className="preview-header-box">
              <div className="preview-title-field">
                <label className="field-label" htmlFor="novel-edit-title">
                  Tên truyện hiển thị:
                </label>
                <input
                  id="novel-edit-title"
                  className="custom-text-input large-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="preview-metrics-grid">
                <div className="metric-card">
                  <span className="metric-number">{number(preview.total)}</span>
                  <span className="metric-tag">CHƯƠNG PHÁT HIỆN</span>
                </div>
                <div className="metric-card">
                  <span className="metric-number">{preview.duration_seconds}s</span>
                  <span className="metric-tag">TỐC ĐỘ PHÂN TÍCH</span>
                </div>
              </div>

              <label className="overwrite-toggle-card">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                <span className="toggle-label-text">
                  Ghi đè nội dung nếu bộ truyện này đã tồn tại trong hệ thống (Overwrite)
                </span>
              </label>
            </div>

            <div className="preview-samples-box">
              <div className="sample-block-title">
                MẪU CÁC CHƯƠNG ĐẦU ({preview.first_chapters.length} CHƯƠNG):
              </div>
              <div className="sample-chapter-stack">
                {preview.first_chapters.map((ch) => (
                  <div key={ch.position} className="sample-chapter-card">
                    <div className="chapter-meta-line">
                      <span className="chapter-badge">Chương #{ch.number}</span>
                      <strong className="chapter-heading-text">{ch.title}</strong>
                    </div>
                    <p className="chapter-snippet-text">{ch.excerpt}</p>
                  </div>
                ))}
              </div>

              {preview.last_chapters.length > 0 && (
                <>
                  <div className="middle-chapters-separator">
                    <span>
                      … và{' '}
                      {number(
                        preview.total -
                          preview.first_chapters.length -
                          preview.last_chapters.length,
                      )}{' '}
                      chương ở giữa …
                    </span>
                  </div>

                  <div className="sample-block-title">MẪU CÁC CHƯƠNG CUỐI:</div>
                  <div className="sample-chapter-stack">
                    {preview.last_chapters.map((ch) => (
                      <div key={ch.position} className="sample-chapter-card">
                        <div className="chapter-meta-line">
                          <span className="chapter-badge">Chương #{ch.number}</span>
                          <strong className="chapter-heading-text">{ch.title}</strong>
                        </div>
                        <p className="chapter-snippet-text">{ch.excerpt}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer-actions">
              <button
                className="button secondary"
                onClick={() => setPreview(null)}
                disabled={saving}
              >
                <RefreshCw size={16} />
                Chọn lại file khác
              </button>
              <button
                className="button primary btn-highlight"
                onClick={handleConfirmSave}
                disabled={saving || !isLoggedIn}
              >
                {saving ? (
                  <>
                    <LoaderCircle className="spinner" size={18} />
                    Đang lưu vào database…
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Xác nhận Lưu vào Hệ Thống
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
