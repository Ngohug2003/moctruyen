import { BookOpen, Check, Minus, Moon, Plus, Sun } from 'lucide-react';
import { setPreferences, useReaderState } from '../../data/reader-store';

import { IconButton, Modal } from '../../ui/primitives';
export function Preferences({ onClose }: { onClose: () => void }) {
  const { preferences } = useReaderState();
  return (
    <Modal title="Góc đọc của bạn" onClose={onClose}>
      <p className="dialog-intro">Một trang sách, theo cách của bạn.</p>
      <span className="field-label">MÀU TRANG</span>
      <div className="theme-options">
        {(
          [
            { key: 'paper', label: 'Sáng', icon: <Sun size={19} /> },
            { key: 'sepia', label: 'Giấy ngà', icon: <BookOpen size={19} /> },
            { key: 'night', label: 'Ban đêm', icon: <Moon size={19} /> },
          ] as const
        ).map((theme) => (
          <button
            key={theme.key}
            className={`theme-choice swatch-${theme.key} ${preferences.theme === theme.key ? 'selected' : ''}`}
            aria-pressed={preferences.theme === theme.key}
            onClick={() => setPreferences({ theme: theme.key })}
          >
            {theme.icon}
            <span>{theme.label}</span>
            {preferences.theme === theme.key && <Check className="theme-check" size={14} />}
          </button>
        ))}
      </div>
      <div className="preference-row">
        <span>Cỡ chữ</span>
        <div className="stepper">
          <IconButton
            label="Giảm cỡ chữ"
            disabled={preferences.fontSize <= 16}
            onClick={() => setPreferences({ fontSize: preferences.fontSize - 1 })}
          >
            <Minus size={17} />
          </IconButton>
          <output>{preferences.fontSize}</output>
          <IconButton
            label="Tăng cỡ chữ"
            disabled={preferences.fontSize >= 32}
            onClick={() => setPreferences({ fontSize: preferences.fontSize + 1 })}
          >
            <Plus size={17} />
          </IconButton>
        </div>
      </div>
      <div className="preference-row">
        <span>Giãn dòng</span>
        <div className="stepper">
          <IconButton
            label="Giảm giãn dòng"
            disabled={preferences.lineHeight <= 1.5}
            onClick={() =>
              setPreferences({
                lineHeight: Math.max(1.5, Number((preferences.lineHeight - 0.1).toFixed(1))),
              })
            }
          >
            <Minus size={17} />
          </IconButton>
          <output>{preferences.lineHeight.toFixed(1)}</output>
          <IconButton
            label="Tăng giãn dòng"
            disabled={preferences.lineHeight >= 2.3}
            onClick={() =>
              setPreferences({
                lineHeight: Math.min(2.3, Number((preferences.lineHeight + 0.1).toFixed(1))),
              })
            }
          >
            <Plus size={17} />
          </IconButton>
        </div>
      </div>
      <label className="preference-row">
        <span>Phông chữ có chân</span>
        <input
          type="checkbox"
          checked={preferences.serif}
          onChange={(event) => setPreferences({ serif: event.target.checked })}
        />
      </label>
      <div
        className="preference-sample"
        style={{
          fontFamily: preferences.serif
            ? '"Noto Serif", Georgia, "Times New Roman", serif'
            : 'system-ui',
          fontSize: preferences.fontSize,
          lineHeight: preferences.lineHeight,
        }}
      >
        Đọc chậm, đi thật xa.
      </div>
      <p className="muted small">Lựa chọn được lưu trên trình duyệt này.</p>
    </Modal>
  );
}
