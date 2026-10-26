import { chromium, expect } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'test-results');
mkdirSync(output, { recursive: true });
const url = process.argv[2] || process.env.MOC_TEST_URL || 'http://localhost:5178';
const executablePath =
  process.env.MOC_BROWSER ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  reducedMotion: 'reduce',
});
const errors = [];
const requests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (request.url().includes('/books/')) requests.push(request.url());
});
try {
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Thư viện của bạn', exact: true })).toBeVisible();
  await expect(page.locator('.book-card')).toHaveCount(2);
  expect(requests.filter((path) => path.includes('.book'))).toHaveLength(0);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(output, 'desktop-library.png'), fullPage: true });
  const coverBounds = await page.evaluate(() => {
    for (const title of document.querySelectorAll('.cover-title'))
      title.textContent = 'Một tên truyện rất dài để kiểm tra bố cục '.repeat(8);
    return [...document.querySelectorAll('.cover-frame')].every((frame) => {
      const footer = frame.querySelector('.cover-footer').getBoundingClientRect();
      const bounds = frame.getBoundingClientRect();
      return (
        footer.bottom <= bounds.bottom && footer.top >= bounds.top && footer.right <= bounds.right
      );
    });
  });
  expect(coverBounds).toBe(true);
  await page.getByLabel('Mục lục Đế Bá', { exact: true }).click();
  await expect(page.locator('.chapter-row')).toHaveCount(50);
  const firstTitle = await page.locator('.chapter-row-title').first().innerText();
  await page.getByLabel('Trang mục lục tiếp theo', { exact: true }).click();
  await expect(page.locator('.chapter-number').first()).toHaveText('51');
  await page.getByLabel('Trang mục lục trước', { exact: true }).click();
  await expect(page.locator('.chapter-number').first()).toHaveText('1');
  await page.getByLabel('Tìm tên hoặc số chương', { exact: true }).fill('11');
  await expect.poll(async () => page.locator('.chapter-row').count()).toBeGreaterThan(0);
  await expect(page.locator('.chapter-row').first()).toContainText('11');
  await page.getByLabel('Xóa tìm kiếm chương', { exact: true }).click();
  await expect(page.locator('.chapter-row')).toHaveCount(50);
  await page.locator('.chapter-row').first().click();
  await expect(page.locator('.chapter-content p').first()).toBeVisible();
  expect(requests.filter((path) => path.endsWith('.book')).length).toBeLessThanOrEqual(1);
  await page.getByLabel('Đánh dấu chương', { exact: true }).click();
  await expect(page.getByLabel('Bỏ đánh dấu chương', { exact: true })).toBeVisible();
  await page.evaluate(() =>
    window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.45),
  );
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('moc-web-reader-v1')).progress[
            Object.keys(JSON.parse(localStorage.getItem('moc-web-reader-v1')).progress)[0]
          ].ratio,
      ),
    )
    .toBeGreaterThan(0.4);
  await page.reload();
  await expect(page.locator('.chapter-content p').first()).toBeAttached();
  await expect
    .poll(() =>
      page.evaluate(() => window.scrollY / (document.documentElement.scrollHeight - innerHeight)),
    )
    .toBeGreaterThan(0.4);
  await page.getByLabel('Mở cài đặt đọc', { exact: true }).click();
  await page.getByRole('button', { name: 'Ban đêm', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.getByLabel('Tăng cỡ chữ', { exact: true }).click();
  await page.getByLabel('Đóng góc đọc của bạn', { exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(output, 'desktop-reader-night.png') });
  await page.getByRole('button', { name: 'Mục lục', exact: true }).last().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Đóng mục lục', { exact: true }).click();
  await page.getByLabel('Chương tiếp theo', { exact: true }).click();
  await expect(page).toHaveURL(/\/1$/);
  await expect(page.locator('.chapter-content p').first()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.values(JSON.parse(localStorage.getItem('moc-web-reader-v1')).progress)[0].position,
      ),
    )
    .toBe(1);
  await page.goto(`${url}/#/saved`);
  await expect(page.locator('.saved-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await expect(page.locator('.saved-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Thư viện', exact: false }).first().click();
  await expect(page.getByRole('heading', { name: 'Thư viện của bạn', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đọc tiếp', exact: true }).first().click();
  await expect(page).toHaveURL(/\/1$/);
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  mobile.on('pageerror', (error) => errors.push(error.message));
  await mobile.goto(url);
  await expect(mobile.locator('.book-card')).toHaveCount(2);
  expect(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await mobile.evaluate(() => document.fonts.ready);
  await mobile.screenshot({ path: resolve(output, 'mobile-library.png'), fullPage: true });
  await mobile.getByRole('button', { name: 'Bắt đầu đọc', exact: true }).first().click();
  await expect(mobile.locator('.chapter-content p').first()).toBeVisible();
  expect(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await mobile.evaluate(() => document.fonts.ready);
  await mobile.screenshot({ path: resolve(output, 'mobile-reader.png') });
  await mobile.getByLabel('Mở cài đặt đọc', { exact: true }).click();
  await expect(mobile.getByRole('dialog')).toBeVisible();
  await mobile.getByRole('button', { name: 'Giấy ngà', exact: true }).click();
  await expect(mobile.locator('html')).toHaveAttribute('data-theme', 'sepia');
  await mobile.getByLabel('Đóng góc đọc của bạn', { exact: true }).click();
  expect(errors).toEqual([]);
  writeFileSync(
    resolve(output, 'browser-report.json'),
    JSON.stringify(
      {
        passed: true,
        url,
        desktop: '1440x1050',
        mobile: '390x844',
        consoleErrors: errors,
        checked: [
          'metadata pagination',
          'lazy chapter loading',
          'search',
          'bookmarks',
          'saved progress after reload',
          'resume last chapter',
          'theme persistence',
          'font controls',
          'mobile overflow',
          'native dialogs',
        ],
        firstTitle,
      },
      null,
      2,
    ),
  );
  console.log('Browser checks passed; screenshots saved in test-results.');
} finally {
  await browser.close();
}
