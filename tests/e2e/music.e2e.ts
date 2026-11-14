/** Production music preferences use the real menu and remain independent of game saves. */
import { boot, expect, test } from './helpers';

test('audio is silent by default, persists controls, and requires an explicit resume after reload', async ({ page }) => {
  await boot(page);
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('music-toggle').click();
  await expect(page.getByTestId('music-status')).toContainText('Playing Awareness Loop');
  await page.getByTestId('music-quieter').click();
  await expect(page.getByTestId('music-volume')).toHaveText('Volume 20%');
  await page.reload();
  await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('music-status')).toContainText('paused');
  await expect(page.getByTestId('music-volume')).toHaveText('Volume 20%');
  await page.getByTestId('music-resume').click();
  await expect(page.getByTestId('music-status')).toContainText('Playing Awareness Loop');
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
  await expect(page.getByTestId('music-status')).toContainText('Playing Awareness Loop');
});
