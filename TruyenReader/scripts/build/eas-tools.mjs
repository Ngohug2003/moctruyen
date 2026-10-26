import { spawnSync } from 'node:child_process';
import {
  readFileSync,
  existsSync,
  mkdirSync,
  createWriteStream,
  openSync,
  readSync,
  closeSync,
  renameSync,
  copyFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
export const PROJECT = {
  id: 'db746cc1-15a8-4af4-907d-85223d4beb70',
  owner: 'viethung111003s-team',
  slug: 'moctruyen',
};
export const PROJECT_URL = 'https://expo.dev/accounts/viethung111003s-team/projects/moctruyen';
export function verifyProjectConfig(root) {
  const app = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')).expo;
  if (
    app.owner !== PROJECT.owner ||
    app.slug !== PROJECT.slug ||
    app.extra?.eas?.projectId !== PROJECT.id
  )
    throw new Error(
      'Cấu hình không trỏ đúng project Expo moctruyen. Kiểm tra app.json trước khi build.',
    );
  return app;
}
export function runEas(root, args, capture = false) {
  const cli = resolve(root, 'node_modules/eas-cli/bin/run');
  if (!existsSync(cli)) throw new Error('Thiếu EAS CLI. Chạy npm ci trong thư mục TruyenReader.');
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    env: { ...process.env, EAS_NO_VCS: '1', EAS_PROJECT_ROOT: root },
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Lệnh EAS chưa thành công: eas ${args[0]}. Xem thông báo phía trên.`);
  return capture ? result.stdout : '';
}
export function parseBuildList(text) {
  const rows = JSON.parse(text);
  if (!Array.isArray(rows)) throw new Error('Kết quả danh sách build không hợp lệ.');
  return rows;
}
export function selectBuild(rows, message) {
  const build = rows.find(
    (row) =>
      row.message === message &&
      row.status === 'FINISHED' &&
      (row.platform === 'ANDROID' || row.platform === 'android'),
  );
  if (!build)
    throw new Error('Chưa tìm thấy bản build vừa hoàn tất. Mở tab Builds của project để kiểm tra.');
  if (build.project?.id && build.project.id !== PROJECT.id)
    throw new Error('Build không thuộc project moctruyen.');
  return build;
}
export async function downloadApk(root, build, meta = null) {
  const url = build.artifacts?.applicationArchiveUrl || build.artifacts?.buildUrl;
  if (!url || new URL(url).protocol !== 'https:')
    throw new Error('Build chưa có URL tải APK HTTPS.');
  const folder = resolve(root, 'build');
  mkdirSync(folder, { recursive: true });
  const buildUrl = `https://expo.dev/accounts/${PROJECT.owner}/projects/${PROJECT.slug}/builds/${build.id}`;
  writeFileSync(
    resolve(folder, 'BUILD_INFO.json'),
    JSON.stringify(
      {
        buildId: build.id,
        projectId: PROJECT.id,
        buildUrl,
        artifactUrl: url,
        book: meta,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  const temp = resolve(folder, 'MocReader.apk.tmp');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Đang tải APK về máy${attempt > 1 ? ` (lần ${attempt})` : ''}…`);
      const response = await fetch(url, { signal: AbortSignal.timeout(15 * 60 * 1000) });
      if (!response.ok || !response.body)
        throw new Error(`Máy chủ tải APK trả HTTP ${response.status}.`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(temp));
      const fd = openSync(temp, 'r');
      const header = Buffer.alloc(4);
      try {
        readSync(fd, header, 0, 4, 0);
      } finally {
        closeSync(fd);
      }
      if (header.toString('hex') !== '504b0304')
        throw new Error('File tải về không phải gói APK/ZIP hợp lệ.');
      renameSync(temp, resolve(folder, 'MocReader.apk'));
      const appJson = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')).expo;
      const verName = appJson.version || '1.0.8';
      const versionedApk = resolve(folder, `MocReader-v${verName}.apk`);
      copyFileSync(resolve(folder, 'MocReader.apk'), versionedApk);
      console.log(`\nAPK đã lưu: ${resolve(folder, 'MocReader.apk')}\nBản version: ${versionedApk}\nTrang build: ${buildUrl}`);
      return;
    } catch (error) {
      if (attempt === 3)
        throw new Error(
          `Chưa tải được APK: ${error.message}\nCó thể tải tại ${buildUrl}\nHoặc chạy TAI_LAI_APK.bat để tải lại mà không build thêm.`,
        );
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
}
