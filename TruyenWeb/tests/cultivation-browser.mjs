import { chromium, expect } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://localhost:5178');
  await page.getByRole('button', { name: 'Cảnh giới', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Cảnh giới Đế Bá', exact: true });
  await expect(dialog.getByText('Khấu Cung Cảnh', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Thác Cương Cảnh', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Khấu Môn → Tỉnh Giác → Huyết Dũng/)).toBeVisible();
  await dialog.getByLabel('Tìm cảnh giới').fill('thac cuong');
  await expect(dialog.locator('.realm-card')).toHaveCount(1);
  await expect(dialog.getByText('Thác Cương Cảnh', { exact: true })).toBeVisible();
  await dialog.getByLabel('Tìm cảnh giới').fill('ich cung');
  await expect(dialog.getByText('Tịch Cung Cảnh', { exact: true })).toBeVisible();
  await dialog.getByLabel('Tìm cảnh giới').fill('');
  await dialog.getByLabel('GIỚI VỰC').selectOption('de-ba-bat-hoang');
  await dialog.getByLabel('Tìm cảnh giới').fill('thien ton');
  await expect(dialog.locator('.realm-card')).toHaveCount(1);
  await expect(dialog.getByText('Vạn Đạo Thiên Khu · Thiên Tôn', { exact: true })).toBeVisible();
  await dialog.getByLabel('GIỚI VỰC').selectOption('de-ba-thien-canh');
  await expect(
    dialog.getByText('Tham khảo · chưa xác nhận thứ bậc', { exact: true }),
  ).toBeVisible();
  await dialog.getByLabel('GIỚI VỰC').selectOption('de-ba-cuu-gioi');
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/cultivation-desktop.png' });
  await dialog.getByRole('button', { name: 'Đóng cảnh giới đế bá', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/public/books/*/cultivation', (route) => route.abort());
  await page.getByRole('button', { name: 'Cảnh giới', exact: true }).first().click();
  await expect(dialog.getByText(/Bản lưu ngoại tuyến/)).toBeVisible();
  await expect(dialog.getByText('Khấu Cung Cảnh', { exact: true })).toBeVisible();
  const horizontalOverflow = await dialog.evaluate(
    (node) => node.scrollWidth > node.clientWidth + 1,
  );
  expect(horizontalOverflow).toBe(false);
  await page.screenshot({ path: 'test-results/cultivation-mobile.png' });
  expect(errors).toEqual([]);
  console.log(
    'Cultivation browser: full names/sublevels, aliases, world groups, search, mobile and offline fallback passed.',
  );
} finally {
  await browser.close();
}
