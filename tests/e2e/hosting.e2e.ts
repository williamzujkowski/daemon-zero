/** Root archives and Pages exports must load their own assets, never a root fallback. */
import { boot, expect, test } from './helpers';

test('all exported asset URLs resolve inside the deployment base path', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', (response) => { if (response.status() >= 400) failed.push(response.url()); });
  page.on('requestfailed', (request) => failed.push(request.url()));
  await boot(page);
  const prefix = (process.env.DAEMON_WEB_BASE_PATH ?? '') + '/';
  const assets = page.locator('script[src], link[href]');
  expect(await assets.count()).toBeGreaterThan(0);
  for (const asset of await assets.all()) {
    const value = await asset.getAttribute('src') ?? await asset.getAttribute('href');
    expect(value).toBeTruthy();
    const url = new URL(value ?? '', page.url());
    expect(url.origin).toBe(new URL(page.url()).origin);
    expect(url.pathname.startsWith(prefix)).toBe(true);
    const response = await page.request.get(url.href);
    expect(response.ok()).toBe(true);
  }
  expect(failed).toEqual([]);
});
