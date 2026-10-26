import { useEffect, useState } from 'react';
import { cloud } from '../../api/cloud';
export function AccountPanel() {
  const [, redraw] = useState(0);
  const [open, setOpen] = useState(false);
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => cloud.subscribe(() => redraw((n) => n + 1)), []);
  async function submit() {
    setBusy(true);
    setError('');
    try {
      await cloud.login(email, password, register ? name : undefined);
      setPassword('');
      await cloud.sync();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không kết nối được máy chủ.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-control">
      <button className="button secondary" onClick={() => setOpen(!open)}>
        {cloud.user?.name || 'Đăng nhập'}
      </button>
      {open && (
        <div className="account-popover">
          <h3>
            {cloud.user ? 'Tài khoản của bạn' : register ? 'Tạo tài khoản Mộc' : 'Chào bạn trở lại'}
          </h3>
          {cloud.user ? (
            <>
              <p>{cloud.user.email}</p>
              <p role="status">{cloud.message}</p>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => {
                  void cloud.sync();
                }}
              >
                Đồng bộ tiến độ
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void cloud
                    .logout()
                    .catch((e) => setError(String(e)))
                    .finally(() => setBusy(false));
                }}
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {register && (
                <input
                  aria-label="Tên hiển thị"
                  placeholder="Tên hiển thị"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={80}
                />
              )}
              <input
                aria-label="Email"
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                aria-label="Mật khẩu"
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                placeholder="Mật khẩu (ít nhất 8 ký tự)"
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button className="button primary" disabled={busy}>
                {busy ? 'Đang kết nối…' : register ? 'Đăng ký' : 'Đăng nhập'}
              </button>
              <button type="button" className="text-button" onClick={() => setRegister(!register)}>
                {register ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
              </button>
            </form>
          )}
          {error && <p role="alert">{error}</p>}
          <p>Tiến độ được lưu riêng theo tài khoản. Đồng bộ trước khi đổi thiết bị.</p>
        </div>
      )}
    </div>
  );
}
