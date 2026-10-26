import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const android = resolve(root, 'android');
const result = spawnSync(
  process.platform === 'win32' ? 'cmd.exe' : 'sh',
  process.platform === 'win32'
    ? ['/d', '/s', '/c', 'gradlew.bat assembleRelease']
    : ['./gradlew', 'assembleRelease'],
  { cwd: android, stdio: 'inherit' },
);
if (result.status !== 0) {
  console.error(
    'Build chưa thành công. Cần JDK và Android SDK theo yêu cầu của phiên bản Expo. Xem README.md.',
  );
  process.exit(1);
}
const apk = resolve(android, 'app/build/outputs/apk/release/app-release.apk');
if (!existsSync(apk)) throw new Error('Không tìm thấy APK sau khi build.');
mkdirSync(resolve(root, 'build'), { recursive: true });
copyFileSync(apk, resolve(root, 'build/MocReader.apk'));
console.log('APK: ' + resolve(root, 'build/MocReader.apk'));
