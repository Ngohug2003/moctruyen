import { chromium, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const email = `qa-${Date.now()}@example.com`;
try {
  await page.goto('http://localhost:5178');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' }).click();
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Kiểm thử Mộc');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('TestReader123!');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page.getByText('Đã đồng bộ tiến độ', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kiểm thử Mộc', exact: true }).click();
  await page.getByLabel('Mục lục Đế Bá', { exact: true }).click();
  await page.locator('.chapter-row').first().click();
  await expect(page.locator('.chapter-content p').first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const session = JSON.parse(sessionStorage.getItem('moc-session'));
        const response = await fetch('http://localhost:8000/api/v1/reader/progress', {
          headers: { Authorization: 'Bearer ' + session.token },
        });
        const result = await response.json();
        return result.data.items.length;
      }),
    )
    .toBe(1);
  const session = await page.evaluate(() => sessionStorage.getItem('moc-session'));
  const second = await context.newPage();
  await second.goto('http://localhost:5178');
  await second.evaluate((value) => {
    sessionStorage.setItem('moc-session', value);
  }, session);
  await second.reload();
  await expect
    .poll(async () =>
      second.evaluate(() => {
        const s = JSON.parse(sessionStorage.getItem('moc-session'));
        const cache = JSON.parse(
          localStorage.getItem('moc-web-reader-account-' + s.user.id) || '{}',
        );
        return Object.keys(cache.progress || {}).length;
      }),
    )
    .toBe(1);
  await second.getByRole('button', { name: 'Kiểm thử Mộc', exact: true }).click();
  await second.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(second.locator('.account-control > button')).toHaveText('Đăng nhập');
  expect(errors).toEqual([]);
  console.log('Browser auth + chapter API + server progress + reload + logout passed.');
} finally {
  await browser.close();
  // Remove only the temporary account created by this test, retaining real users/content.
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    'C:/Program Files/Docker/Docker/resources/bin/docker.exe',
    [
      'compose',
      '--env-file',
      '.docker.env',
      'exec',
      '-T',
      'api',
      'python',
      '-m',
      'tests.support.cleanup_user',
      email,
    ],
    { cwd: 'C:/Truyen/TruyenBackend', encoding: 'utf8' },
  );
  if (result.status !== 0) console.error('Temporary account cleanup failed', result.stderr);
}
