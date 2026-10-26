import { chromium, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
const url = process.argv[2] || process.env.MOC_TEST_URL || 'http://localhost:5178';
const executablePath =
  process.env.MOC_BROWSER ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(existsSync);
const [book] = JSON.parse(
  readFileSync(new URL('../public/books/index.json', import.meta.url), 'utf8'),
);
const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const signedIn of [false, true]) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const contentRequests = [];
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await context.route('**/api/v1/**', (route) => {
      if (route.request().url().includes('/public/')) contentRequests.push(route.request().url());
      return route.abort();
    });
    if (signedIn)
      await context.addInitScript(() => {
        sessionStorage.setItem(
          'moc-session',
          JSON.stringify({
            token: 'offline-test-token',
            user: { id: 'offline-reader', name: 'Bạn đọc offline', email: 'offline@example.test' },
          }),
        );
      });
    await page.goto(url);
    await expect(page.locator('.book-card')).toHaveCount(2, { timeout: 15000 });
    if (signedIn)
      await expect(
        page.getByRole('button', { name: 'Bạn đọc offline', exact: true }),
      ).toBeVisible();
    await page.getByLabel('Mục lục Đế Bá', { exact: true }).click();
    await expect(page.locator('.chapter-row')).toHaveCount(50);
    await page.getByLabel('Trang mục lục tiếp theo', { exact: true }).click();
    await expect(page.locator('.chapter-number').first()).toHaveText('51');
    await page.locator('.chapter-row').first().click();
    await expect(page.locator('.chapter-content p').first()).toBeVisible();
    await page.getByLabel('Đánh dấu chương', { exact: true }).click();
    await page.getByLabel('Chương tiếp theo', { exact: true }).click();
    await expect(page).toHaveURL(/\/51$/);
    await expect(page.locator('.chapter-content p').first()).toBeVisible();
    await page.evaluate(() =>
      window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.5),
    );
    const key = signedIn ? 'moc-web-reader-account-offline-reader' : 'moc-web-reader-v1';
    await expect
      .poll(() =>
        page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).progress[id]?.ratio, {
          key,
          id: book.id,
        }),
      )
      .toBeGreaterThan(0.4);
    await page.reload();
    await expect(page.locator('.chapter-content p').first()).toBeAttached();
    await expect
      .poll(() =>
        page.evaluate(() => window.scrollY / (document.documentElement.scrollHeight - innerHeight)),
      )
      .toBeGreaterThan(0.4);
    await page.goto(`${url}/#/saved`);
    await expect(page.locator('.saved-card')).toHaveCount(1);
    await page.goto(url);
    await page.getByRole('button', { name: 'Đọc tiếp', exact: true }).first().click();
    await expect(page).toHaveURL(/\/51$/);
    await page.getByRole('button', { name: 'Cảnh giới', exact: true }).first().click();
    await expect(page.getByText('Khấu Cung Cảnh', { exact: true })).toBeVisible();
    expect(contentRequests).toEqual([]);
    expect(errors).toEqual([]);
    if (signedIn)
      expect(await page.evaluate(() => localStorage.getItem('moc-web-reader-v1'))).toBeNull();
    await context.close();
    console.log(
      `JSON reading with all API requests blocked: ${signedIn ? 'cached account' : 'guest'} passed.`,
    );
  }
  // A deployment without JSON can still use the optional API catalog/chapter.
  const context = await browser.newContext();
  await context.route('**/books/**', (route) =>
    route.fulfill({ status: 404, body: 'Missing local data' }),
  );
  const remoteBook = { ...book, id: 'remote-book', title: 'Truyện từ API', total: 1 };
  const chapter = {
    id: 'remote-chapter',
    position: 0,
    number: 1,
    title: 'Chương API',
    content: 'Nội dung chương từ API dự phòng.',
  };
  await context.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/chapters/0')
      ? chapter
      : path.endsWith('/chapters')
        ? { items: [chapter], total: 1 }
        : { items: [remoteBook], total: 1 };
    return route.fulfill({ json: { success: true, data } });
  });
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.locator('.book-card')).toContainText('Truyện từ API');
  await page.getByLabel('Mục lục Truyện từ API', { exact: true }).click();
  await expect(page.locator('.chapter-row')).toHaveCount(1);
  await page.locator('.chapter-row').first().click();
  await expect(page.locator('.chapter-content')).toContainText(chapter.content);
  await context.close();
  console.log('API fallback with local JSON missing passed.');
} finally {
  await browser.close();
}
