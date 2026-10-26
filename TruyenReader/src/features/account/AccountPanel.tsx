import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { cloud } from '../../api/cloud';
export function AccountPanel({
  onChange,
  textColor,
}: {
  onChange: () => Promise<void>;
  textColor: string;
}) {
  const [, redraw] = useState(0);
  const [open, setOpen] = useState(false),
    [register, setRegister] = useState(false);
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState('');
  const [url, setUrl] = useState(cloud.url),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => cloud.subscribe(() => redraw((n) => n + 1)), []);
  async function action(kind: 'login' | 'logout' | 'sync') {
    setBusy(true);
    setError('');
    try {
      if (kind === 'logout') await cloud.logout();
      else {
        if (kind === 'login') {
          await cloud.setUrl(url);
          await cloud.login(email.trim(), password, register ? name.trim() : undefined);
          setPassword('');
        }
        await cloud.sync();
      }
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không kết nối được máy chủ.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Pressable
        accessibilityLabel="Tài khoản"
        onPress={() => {
          setUrl(cloud.url);
          setOpen(true);
        }}
        style={s.trigger}
      >
        <Text numberOfLines={1} style={{ color: textColor }}>
          {cloud.user?.name || 'Đăng nhập'}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.card}>
            <Text style={s.title}>
              {cloud.user ? 'Tài khoản Mộc' : register ? 'Tạo tài khoản' : 'Chào bạn trở lại'}
            </Text>
            {cloud.user ? (
              <>
                <Text>{cloud.user.email}</Text>
                <Text accessibilityLiveRegion="polite">{cloud.message}</Text>
                <Pressable disabled={busy} style={s.button} onPress={() => void action('sync')}>
                  <Text style={s.white}>Đồng bộ tiến độ</Text>
                </Pressable>
                <Pressable disabled={busy} onPress={() => void action('logout')}>
                  <Text style={s.green}>Đăng xuất</Text>
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  style={s.input}
                  accessibilityLabel="Địa chỉ API"
                  autoCapitalize="none"
                  value={url}
                  onChangeText={setUrl}
                  placeholder="http://IP-máy-tính:8000"
                />
                {register && (
                  <TextInput
                    style={s.input}
                    accessibilityLabel="Tên hiển thị"
                    value={name}
                    onChangeText={setName}
                    placeholder="Tên hiển thị"
                    maxLength={80}
                  />
                )}
                <TextInput
                  style={s.input}
                  accessibilityLabel="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                />
                <TextInput
                  style={s.input}
                  accessibilityLabel="Mật khẩu"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mật khẩu (ít nhất 8 ký tự)"
                  maxLength={128}
                />
                <Pressable disabled={busy} style={s.button} onPress={() => void action('login')}>
                  <Text style={s.white}>
                    {busy ? 'Đang kết nối…' : register ? 'Đăng ký' : 'Đăng nhập'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setRegister(!register)}>
                  <Text style={s.green}>
                    {register ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
                  </Text>
                </Pressable>
              </>
            )}
            {error ? <Text accessibilityRole="alert">{error}</Text> : null}
            <Text>
              Tiến độ lưu riêng theo tài khoản. Máy tính và điện thoại cần cùng Wi-Fi khi dùng API
              cục bộ.
            </Text>
            <Pressable style={s.button} onPress={() => setOpen(false)}>
              <Text style={s.white}>Đóng</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
const s = StyleSheet.create({
  trigger: { padding: 12, maxWidth: 100, flexShrink: 1 },
  green: { color: '#234B38' },
  white: { color: '#fff' },
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0008' },
  card: { backgroundColor: '#F5F2EB', padding: 24, borderRadius: 20, gap: 16 },
  title: { fontSize: 24, color: '#234B38', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#93A08E', borderRadius: 8, padding: 12, color: '#234B38' },
  button: { backgroundColor: '#234B38', borderRadius: 8, padding: 14, alignItems: 'center' },
});
