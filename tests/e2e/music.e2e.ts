/** Production music preferences use the real menu and remain independent of game saves. */
import { createHash } from 'node:crypto';
import tracks from '../../assets/audio/music/tracks.json';
import { boot, expect, test } from './helpers';

test('audio is silent by default, persists controls, and requires an explicit resume after reload', async ({ page }) => {
  await boot(page);
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-checked', 'false');
  const loading = page.waitForResponse((response) => response.url().includes('/audio/music/phase-0/the-guest.') && response.ok());
  await page.getByTestId('music-toggle').click();
  const asset = await loading;
  expect(asset.url().startsWith(new URL('assets/', page.url()).href)).toBe(true);
  const exported = await page.request.get(asset.url());
  expect(exported.ok()).toBe(true);
  expect(createHash('sha256').update(await exported.body()).digest('hex')).toBe(tracks[0]?.sha256);
  await expect(page.getByTestId('music-status')).toContainText('Playing phase 0 score');
  await page.getByTestId('music-quieter').click();
  await expect(page.getByTestId('music-volume')).toHaveText('Volume 20%');
  await page.reload();
  await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('music-status')).toContainText('paused');
  await expect(page.getByTestId('music-volume')).toHaveText('Volume 20%');
  await page.getByTestId('music-resume').click();
  await expect(page.getByTestId('music-status')).toContainText('Playing phase 0 score');
  await page.getByTestId('music-toggle').click();
  await expect(page.getByTestId('music-status')).toHaveText('Music is off.');
});

test('autoplay denial is visible and a user retry recovers without a phantom playing state', async ({ page }) => {
  await page.addInitScript(() => {
    const { HTMLMediaElement } = globalThis as unknown as { HTMLMediaElement: { prototype: { play: (this: unknown) => Promise<void> } } };
    const play = HTMLMediaElement.prototype.play;
    let deny = true;
    HTMLMediaElement.prototype.play = function () {
      if (deny) { deny = false; return Promise.reject(new DOMException('Activation required', 'NotAllowedError')); }
      return play.call(this);
    };
  });
  await boot(page);
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  await page.getByTestId('music-toggle').click();
  await expect(page.getByTestId('music-error')).toContainText('Try Resume');
  await expect(page.getByTestId('music-status')).toContainText('paused');
  await page.getByTestId('music-resume').click();
  await expect(page.getByTestId('music-status')).toContainText('Playing phase 0 score');
});
