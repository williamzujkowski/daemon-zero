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
import { boot, expect, test } from './helpers';

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
