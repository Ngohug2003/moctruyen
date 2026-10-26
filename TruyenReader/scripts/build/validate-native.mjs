import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateAndroidModules(config, expectedVersions = {}) {
  if (!Array.isArray(config.modules) || !config.modules.length)
    throw new Error('Không tìm thấy module native Android trong kết quả autolinking.');
  for (const module of config.modules) {
    const expected = expectedVersions[module.packageName];
    const expectedMajor = expected?.match(/^[~^]?(\d+)\./)?.[1];
    const actualMajor = module.packageVersion?.split('.')[0];
    if (expectedMajor && actualMajor !== expectedMajor)
      throw new Error(
        `${module.packageName}@${module.packageVersion} không khớp SDK (cần ${expected}). Chạy npx expo install ${module.packageName} rồi kiểm tra lại.`,
      );
    for (const project of module.projects ?? []) {
      if (project.publication == null) continue;
      for (const field of ['groupId', 'artifactId', 'version', 'repository']) {
        const value = project.publication[field];
        if (typeof value !== 'string' || !value.trim())
          throw new Error(
            `${module.packageName}@${module.packageVersion}: publication.${field} bị thiếu ở ${project.name}. Chạy npm ci và kiểm tra phiên bản module trước khi build.`,
          );
      }
    }
  }
  return config;
}

export function checkAndroidModules(root) {
  const requireFromApp = createRequire(resolve(root, 'package.json'));
  const expoPackage = requireFromApp.resolve('expo/package.json');
  // Resolve the same autolinking package used by Expo's Android settings plugin.
  const requireFromExpo = createRequire(expoPackage);
  const packageFile = requireFromExpo.resolve('expo-modules-autolinking/package.json');
  const autolinking = JSON.parse(readFileSync(packageFile, 'utf8'));
  const cli = resolve(dirname(packageFile), autolinking.bin['expo-modules-autolinking']);
  const result = spawnSync(process.execPath, [cli, 'resolve', '--platform', 'android', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Không kiểm tra được module Android: ${result.stderr || result.stdout}`);
  const expectedVersions = JSON.parse(
    readFileSync(resolve(dirname(expoPackage), 'bundledNativeModules.json'), 'utf8'),
  );
  return validateAndroidModules(JSON.parse(result.stdout), expectedVersions);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const config = checkAndroidModules(root);
    console.log(`Native Android: ${config.modules.length} module hợp lệ, đủ publication.version.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
