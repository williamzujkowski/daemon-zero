/**
 * The clip has to survive the bundler, not just the unit test.
 *
 * Every unit-level assertion on the player runs against a mock, so none of them can tell a correct
 * clip reference from a broken one: a wrong asset shape, a clip that never got packaged, or a
 * renamed file would all leave the suite green while the game played silence. This drives the real
 * adapter in a real browser and asserts the clip is actually requested and delivered.
 *
 * A panel reviewer raised exactly this: "a wrong asset shape, missing expo-audio native module, or
 * plugin misconfiguration ships silently". This test answers that for web. Native playback still
 * needs a device; see the limits in docs/VOICE-CLIPS.md.
 */
import { test as bare } from '@playwright/test';
import { boot, expect, observeMusicMedia, test, voiceClipsPlaying, voiceClipVolume } from './helpers';
import { OUTPUT_SCALE } from '../../src/app/outputLevel';

const AUDIO_KEY = 'daemon-zero.audio.v1';

test('pressing READ makes the browser fetch the bundled clip', async ({ page }) => {
  const requested: string[] = [];
  const failed: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/voice/')) requested.push(request.url()); });
  page.on('requestfailed', (request) => { if (request.url().includes('/voice/')) failed.push(request.url()); });

  await boot(page, 'decoded-omen', { audio: true });
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  const read = page.getByTestId('speech-read');
  await expect(read).toBeVisible();

  // Nothing is fetched until the player asks: the manual contract, asserted on the wire.
  expect(requested, 'no clip is fetched before a press').toHaveLength(0);
  // A 404 is a response, not a failed request, so the status and the bytes are asserted too.
  const delivered = page.waitForResponse((response) => response.url().includes('/voice/vibration/'));
  await read.click();
  const response = await delivered;

  expect(response.url()).toMatch(/\.mp3$/);
  expect(response.ok(), 'the clip must be served, not merely asked for: HTTP ' + String(response.status())).toBe(true);
  expect((await response.body()).byteLength, 'the served clip has bytes').toBeGreaterThan(1000);
  expect(requested.length).toBeGreaterThan(0);
  expect(failed, 'the clip request must not fail').toHaveLength(0);
});

bare('the delivery guard notices a clip the server does not have', async ({ page }) => {
  // The guard above is only worth having if a missing clip trips it. A panel reviewer showed the
  // first version passed against a 404; this pins the instrument, not the game. It runs without
  // the clean-console fixture because the browser rightly logs the 404 it is being fed.
  await page.route('**/voice/vibration/*.mp3', (route) => route.fulfill({ status: 404, body: '' }));
  await boot(page, 'decoded-omen', { audio: true });
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  const delivered = page.waitForResponse((response) => response.url().includes('/voice/vibration/'));
  await page.getByTestId('speech-read').click();
  expect((await delivered).ok()).toBe(false);
});

test('a stored single-switch preference migrates: speech inherits it and READ plays at that level', async ({ page }) => {
  await observeMusicMedia(page);
  // Version 1, as every install before the split stored it, at a level no default would produce.
  await boot(page, 'decoded-omen', { audio: { version: 1, enabled: true, volume: 50 } });
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  await expect(page.getByTestId('speech-toggle')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('speech-volume')).toHaveText('Speech volume 50%');
  await expect(page.getByTestId('music-volume')).toHaveText('Music volume 50%');
  // Loading is a read: the slot is rewritten only when the player changes something.
  expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '', AUDIO_KEY))).toEqual({ version: 1, enabled: true, volume: 50 });
  await page.getByTestId('speech-louder').click();
  await expect.poll(async () => JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', AUDIO_KEY)) as unknown)
    .toEqual({ version: 2, enabled: true, volume: 50, speechEnabled: true, speechVolume: 60 });
  await page.getByTestId('menu-close').click();
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  await page.getByTestId('speech-read').click();
  await expect.poll(() => voiceClipsPlaying(page)).toBe(1);
  await expect.poll(() => voiceClipVolume(page), 'the clip plays at the speech level, not the music level').toBeCloseTo(0.6 * OUTPUT_SCALE, 5);
});

test('speech works with music off: the clip is fetched and no score is ever created', async ({ page }) => {
  const score: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/audio/music/')) score.push(request.url()); });
  await observeMusicMedia(page);
  await boot(page, 'decoded-omen', { audio: { version: 2, enabled: false, volume: 30, speechEnabled: true, speechVolume: 70 } });
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  const read = page.getByTestId('speech-read');
  await expect(read, 'READ is offered although music is off').toBeVisible();
  const delivered = page.waitForResponse((response) => response.url().includes('/voice/vibration/'));
  await read.click();
  expect((await delivered).ok()).toBe(true);
  await expect.poll(() => voiceClipsPlaying(page), 'the clip is really talking').toBe(1);
  await expect.poll(() => voiceClipVolume(page)).toBeCloseTo(0.7 * OUTPUT_SCALE, 5);

  // Both sets of controls live on the one Audio page, each a full touch target.
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-checked', 'false');
  for (const id of ['music-toggle', 'music-quieter', 'music-louder', 'speech-toggle', 'speech-quieter', 'speech-louder']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(Math.min(box?.width ?? 0, box?.height ?? 0), id + ' is at least 44px').toBeGreaterThanOrEqual(44);
  }
  // Turning speech off silences whatever is talking and withdraws the control.
  await page.getByTestId('speech-toggle').click();
  await expect(page.getByTestId('speech-toggle')).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => voiceClipsPlaying(page), 'speech off stops the clip').toBe(0);
  await page.getByTestId('menu-close').click();
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  await expect(page.getByTestId('decoded-speech')).toBeVisible();
  await expect(read).toHaveCount(0);

  const built = await page.evaluate(() => (globalThis as unknown as { __musicMedia: { src: string }[] }).__musicMedia.map((item) => item.src));
  expect(built.filter((source) => source.includes('/audio/music/')), 'no music element exists').toEqual([]);
  // A released clip clears its source, so the count is what shows the probe was watching.
  expect(built.length, 'the probe saw the clip element, so an empty score list means something').toBeGreaterThan(0);
  expect(score, 'no score was requested').toEqual([]);
});
