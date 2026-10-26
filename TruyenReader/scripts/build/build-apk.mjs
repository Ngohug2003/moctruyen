import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createBundle } from '../content/prepare-book.mjs';
import { verifyBundle } from '../content/verify-bundle.mjs';
import { checkAndroidModules } from './validate-native.mjs';
import {
  runEas,
  verifyProjectConfig,
  parseBuildList,
  selectBuild,
  downloadApk,
  PROJECT_URL,
} from './eas-tools.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
try {
  verifyProjectConfig(root);
  console.log('Kiểm tra phiên bản và cấu hình module native Android…');
  checkAndroidModules(root);
  console.log('1/4 · Chuẩn bị dữ liệu truyện…');
  createBundle(resolve(root, 'input/truyen.json'), resolve(root, 'assets'));
  const meta = verifyBundle(root, true);
  console.log(`${meta.title}: ${meta.count.toLocaleString('vi-VN')} mục.\nProject: ${PROJECT_URL}`);
  if (process.argv.includes('--check-only')) {
    console.log('Dữ liệu và cấu hình đã sẵn sàng; chưa gửi lệnh build.');
    process.exit(0);
  }
  console.log('\n2/4 · Kiểm tra tài khoản và project Expo…');
  runEas(root, ['whoami']);
  const projectInfo = runEas(root, ['project:info'], true);
  if (
    !projectInfo.includes('db746cc1-15a8-4af4-907d-85223d4beb70') ||
    !projectInfo.includes('@viethung111003s-team/moctruyen')
  )
    throw new Error('Project EAS đang liên kết không đúng moctruyen.');
  const message = `MocReader ${meta.hash} ${randomUUID()}`;
  console.log(
    '\n3/4 · Build APK Android trên Expo. Nếu hỏi tạo keystore lần đầu, chọn Generate new keystore.',
  );
  runEas(root, [
    'build',
    '--platform',
    'android',
    '--profile',
    'preview',
    '--wait',
    '--non-interactive',
    '--message',
    message,
  ]);
  console.log('\n4/4 · Lấy APK của bản build vừa hoàn tất…');
  const rows = parseBuildList(
    runEas(
      root,
      [
        'build:list',
        '--platform',
        'android',
        '--build-profile',
        'preview',
        '--status',
        'finished',
        '--limit',
        '30',
        '--json',
        '--non-interactive',
      ],
      true,
    ),
  );
  await downloadApk(root, selectBuild(rows, message), meta);
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
}
