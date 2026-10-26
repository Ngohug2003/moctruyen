import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { runEas, verifyProjectConfig, downloadApk } from './eas-tools.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
try {
  verifyProjectConfig(root);
  const file = resolve(root, 'build/BUILD_INFO.json');
  if (!existsSync(file))
    throw new Error(
      'Chưa có thông tin APK trên máy. Mở tab Builds trên Expo và tải APK của build đã hoàn tất.',
    );
  const info = JSON.parse(readFileSync(file, 'utf8'));
  if (info.projectId !== 'db746cc1-15a8-4af4-907d-85223d4beb70')
    throw new Error('Thông tin APK không thuộc project moctruyen.');
  const build = JSON.parse(runEas(root, ['build:view', info.buildId, '--json'], true));
  if (build.status !== 'FINISHED') throw new Error(`Build chưa hoàn tất: ${build.status}.`);
  await downloadApk(root, build, info.book);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
