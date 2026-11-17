/** Production music preferences use the real menu and remain independent of game saves.
 *  A fresh install starts enabled but silent: activation waits for a real gesture, which
 *  the browser requires, so the first pointer/key input is what starts the score. */
import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import tracks from '../../assets/audio/music/tracks.json';
import { boot, dismissBoot, expect, musicMediaState, observeMusicMedia, test } from './helpers';
import { serveByteRanges } from './signalTap';

function watchMusic(page: Page): Set<string> {
  const requested = new Set<string>();
  page.on('request', (request) => { if (request.url().includes('.mp3')) requested.add(request.url()); });
  return requested;
}

test('starts on and silent, plays after the first interaction, and keeps its controls across a reload', async ({ page }) => {
  const requested = watchMusic(page);
  await boot(page);
  // Enabled is a preference; activation is the gesture. Nothing may be fetched yet.
  expect(requested.size).toBe(0);
  await dismissBoot(page);
  const loading = page.waitForResponse((response) => response.url().includes('/audio/music/phase-0/the-guest.') && response.ok());
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  const asset = await loading;
  expect(asset.url().startsWith(new URL('assets/', page.url()).href)).toBe(true);
  const exported = await page.request.get(asset.url());
  expect(exported.ok()).toBe(true);
  expect(createHash('sha256').update(await exported.body()).digest('hex')).toBe(tracks[0]?.sha256);
  await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('music-status')).toContainText('Playing phase 0 score');
  await page.getByTestId('music-quieter').click();
  await expect(page.getByTestId('music-volume')).toHaveText('Music volume 20%');
  await page.reload();
  await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  // A reload is a new page: playback waits for the next gesture again, and the stored
  // volume survives it.
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('music-volume')).toHaveText('Music volume 20%');
  // A fresh install that only ever touched the music level still has speech on at its default.
  await expect(page.getByTestId('speech-toggle')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('speech-volume')).toHaveText('Speech volume 30%');
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
  // The first gesture is what tries to play, and the browser refuses it once.
  await dismissBoot(page);
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  await expect(page.getByTestId('music-error')).toContainText('Try Resume');
  await expect(page.getByTestId('music-status')).toContainText('paused');
  await page.getByTestId('music-resume').click();
  await expect(page.getByTestId('music-status')).toContainText('Playing phase 0 score');
});

test('plays the tail of the score and loops back to the top', async ({ page }) => {
  // This used to seek to the tail on the suite's static server and watch the position fall
  // below 2 s. That server ignores Range, so the media was unseekable (`seekable` [0, 0]) and the
  // seek itself landed on 0: the "loop" passed without the tail ever playing. Ranges are served
  // here, and the seek is checked to have held before the wrap means anything. The rendered seam
  // is measured in signal-loops.audio-full.ts.
  await serveByteRanges(page, '**/audio/music/**/*.mp3');
  await observeMusicMedia(page);
  await boot(page, 'tick-0'); await dismissBoot(page);
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  await expect.poll(async () => (await musicMediaState(page)).time).toBeGreaterThan(.05);
  const landed = await page.evaluate(() => {
    const media = (globalThis as unknown as { __musicMedia: Array<{ currentTime: number; duration: number }> }).__musicMedia;
    const current = media.at(-1);
    if (!current) return -1;
    current.currentTime = current.duration - .5;
    return current.currentTime;
  });
  expect(landed, 'the seek reached the tail rather than snapping to the start').toBeGreaterThan((tracks[0]?.duration ?? 0) - 2);
  // Loop discipline: the tail plays out and the score returns to the top, not to silence.
  await expect.poll(async () => (await musicMediaState(page)).time).toBeLessThan(2);
  await expect.poll(async () => (await musicMediaState(page)).time, 'and keeps playing').toBeGreaterThan(.05);
  expect((await musicMediaState(page)).active).toBe(1);
});

test('survives an offline toggle without a phantom player', async ({ page }) => {
  // Restored after a panel request_changes: the rewrite had dropped the cached-playback
  // coverage rather than moving it.
  await observeMusicMedia(page);
  await boot(page, 'tick-0'); await dismissBoot(page);
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  await expect.poll(async () => (await musicMediaState(page)).time).toBeGreaterThan(.05);
  expect((await musicMediaState(page)).active).toBe(1);
  await page.getByTestId('music-toggle').click();
  expect((await musicMediaState(page)).active).toBe(0);
  // try/finally: an offline context that leaks into the next spec poisons it.
  await page.context().setOffline(true);
  try {
    await page.getByTestId('music-toggle').click();
    // The asset is already served and cached, so turning music back on works offline.
    await expect(page.getByTestId('music-status')).toContainText('Playing phase 0 score');
  } finally {
    await page.context().setOffline(false);
  }
});
