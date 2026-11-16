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
import { expect, test } from '@playwright/test';
import { boot } from './helpers';

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
  await read.click();

  await expect.poll(() => requested.length, { message: 'the clip must be requested after the press' }).toBeGreaterThan(0);
  expect(requested[0]).toContain('/voice/vibration/');
  expect(requested[0]).toMatch(/\.mp3$/);
  expect(failed, 'the clip request must not fail').toHaveLength(0);
});
