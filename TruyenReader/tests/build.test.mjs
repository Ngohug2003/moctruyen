import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createBundle } from '../scripts/content/prepare-book.mjs';
import { verifyBundle } from '../scripts/content/verify-bundle.mjs';
import { checkAndroidModules, validateAndroidModules } from '../scripts/build/validate-native.mjs';
import { fileURLToPath } from 'node:url';
import {
  parseBuildList,
  selectBuild,
  verifyProjectConfig,
  PROJECT,
} from '../scripts/build/eas-tools.mjs';

test('Android autolinking thật dùng expo-font SDK 57 và có đủ metadata Gradle', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const config = checkAndroidModules(root);
  const font = config.modules.find((module) => module.packageName === 'expo-font');
  assert.match(font.packageVersion, /^57\./);
  assert.equal(font.projects[0].publication.version, font.packageVersion);
});

test('chặn cấu hình publication thiếu version trước khi gửi build Gradle', () => {
  const broken = {
    modules: [
      {
        packageName: 'expo-font',
        packageVersion: '58.0.8',
        projects: [
          {
            name: 'expo-font',
            publication: {
              groupId: 'host.exp.exponent',
              artifactId: 'expo.modules.font',
              repository: 'local-maven-repo',
            },
          },
        ],
      },
    ],
  };
  assert.throws(() => validateAndroidModules(broken), /expo-font@58\.0\.8: publication\.version/);
  assert.throws(() => validateAndroidModules(broken, { 'expo-font': '~57.0.4' }), /không khớp SDK/);
});
test('cloud hook verifies packaged database without input JSON', () => {
  const root = mkdtempSync(join(tmpdir(), 'moc-build-'));
  try {
    const input = join(root, 'truyen.json');
    writeFileSync(
      input,
      JSON.stringify([
        {
          ten_truyen: 'Truyện kiểm tra',
          so_chuong: 1,
          ten_chuong: 'Chương 1',
          noi_dung: 'Văn bản kiểm tra.',
          url: 'https://example.org/1',
        },
      ]),
    );
    createBundle(input, join(root, 'assets'));
    rmSync(input);
    assert.equal(verifyBundle(root).count, 1);
    const file = join(root, 'assets/book-meta.json');
    const meta = JSON.parse(readFileSync(file));
    meta.databaseHash = 'wrong';
    writeFileSync(file, JSON.stringify(meta));
    assert.throws(() => verifyBundle(root), /không khớp/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('demo data cannot pass cloud build hook', () => {
  const root = mkdtempSync(join(tmpdir(), 'moc-demo-'));
  try {
    const input = join(root, 'truyen.json');
    writeFileSync(
      input,
      JSON.stringify([
        {
          ten_truyen: 'Truyện cũ',
          so_chuong: 1,
          ten_chuong: 'Chương 1',
          noi_dung: 'Nội dung mẫu từ bản cũ.',
        },
      ]),
    );
    createBundle(input, join(root, 'assets'));
    const file = join(root, 'assets/book-meta.json');
    const meta = JSON.parse(readFileSync(file));
    meta.demo = true;
    writeFileSync(file, JSON.stringify(meta));
    assert.throws(() => verifyBundle(root), /truyện mẫu/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('download selection requires exact build message and finished Android build', () => {
  const rows = parseBuildList(
    JSON.stringify([
      { id: 'old', message: 'other', platform: 'ANDROID', status: 'FINISHED' },
      {
        id: 'mine',
        message: 'mine',
        platform: 'ANDROID',
        status: 'FINISHED',
        project: { id: PROJECT.id },
      },
    ]),
  );
  assert.equal(selectBuild(rows, 'mine').id, 'mine');
  assert.throws(() => selectBuild(rows, 'missing'));
  assert.throws(() =>
    selectBuild(
      [{ message: 'mine', platform: 'ANDROID', status: 'FINISHED', project: { id: 'wrong' } }],
      'mine',
    ),
  );
});
test('project config must match linked project ID, team and slug', () => {
  const root = mkdtempSync(join(tmpdir(), 'moc-config-'));
  try {
    const file = join(root, 'app.json');
    writeFileSync(
      file,
      JSON.stringify({
        expo: {
          owner: PROJECT.owner,
          slug: PROJECT.slug,
          extra: { eas: { projectId: PROJECT.id } },
        },
      }),
    );
    assert.equal(verifyProjectConfig(root).slug, 'moctruyen');
    writeFileSync(file, JSON.stringify({ expo: { slug: 'wrong' } }));
    assert.throws(() => verifyProjectConfig(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
