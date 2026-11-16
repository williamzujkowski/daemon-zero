/**
 * The score gets out of the way of a spoken transmission, on the real build.
 *
 * The unit tests prove the controller scales what it hands a mocked player and that the voice
 * player reports its edges. Neither can tell whether the two are actually joined in the bundle,
 * or whether the level reaches a real media element. This reads the score element's own volume
 * before a press, while the clip talks, and after the clip has run out by itself.
 *
 * It measures a number, not a sound: nobody has listened to the ducked mix. See the limits in
 * docs/VOICE-CLIPS.md.
 */
import { test as bare } from '@playwright/test';
import { DUCK_RATIO } from '../../src/app/musicController';
import { boot, expect, observeMusicMedia, soundtrackVolume, test, voiceClipsPlaying } from './helpers';

// `boot(..., { audio: true })` seeds this preference; the test asserts against it, not a guess.
const PREFERENCE = 0.3;

test('the score ducks while a transmission is read and returns when the clip ends', async ({ page }) => {
  await observeMusicMedia(page);
  await boot(page, 'decoded-omen', { audio: true });
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  const read = page.getByTestId('speech-read');
  await expect(read).toBeVisible();
  // The score starts on the first gesture, which a phone tab press is and a desktop boot is not.
  // A press on nothing in particular makes both tiers start from the same place: score playing
  // at the preference level, no clip talking.
  await page.getByTestId('terminal-screen').click({ position: { x: 2, y: 2 } });
  await expect.poll(() => soundtrackVolume(page), 'the score plays at the preference level first').toBeCloseTo(PREFERENCE, 5);
  expect(await voiceClipsPlaying(page)).toBe(0);

  await read.click();
  await expect.poll(() => voiceClipsPlaying(page), 'the clip is really talking').toBe(1);
  await expect.poll(() => soundtrackVolume(page), 'the score drops under the voice').toBeCloseTo(PREFERENCE * DUCK_RATIO, 5);

  // No seek and no stop: the clip is left to finish, because the natural ending is the path a
  // player takes and the one a mock cannot stand in for.
  await expect.poll(() => voiceClipsPlaying(page), { message: 'the clip runs out', timeout: 30_000 }).toBe(0);
  await expect.poll(() => soundtrackVolume(page), 'the score comes back').toBeCloseTo(PREFERENCE, 5);
});

bare('the score comes back when the clip fails to load instead of staying ducked under silence', async ({ page }) => {
  // A failed clip never reports an ending, so before the fix the score sat at the ducked level
  // until some unrelated stop. This runs without the clean-console fixture because the browser
  // rightly logs the 404 it is being fed.
  //
  // The 404 is held back until the duck has been observed. Otherwise a fast failure could undo
  // the duck before the first poll, and "the score is at the preference level" would be true of
  // a build that never ducked at all.
  let releaseFailure: () => void = () => undefined;
  const ducked = new Promise<void>((resolve) => { releaseFailure = resolve; });
  await page.route('**/voice/vibration/*.mp3', async (route) => {
    await ducked;
    await route.fulfill({ status: 404, body: '' });
  });
  await observeMusicMedia(page);
  await boot(page, 'decoded-omen', { audio: true });
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  const read = page.getByTestId('speech-read');
  await expect(read).toBeVisible();
  await page.getByTestId('terminal-screen').click({ position: { x: 2, y: 2 } });
  await expect.poll(() => soundtrackVolume(page), 'the score plays at the preference level first').toBeCloseTo(PREFERENCE, 5);

  const answered = page.waitForResponse((response) => response.url().includes('/voice/vibration/'));
  await read.click();
  await expect.poll(() => soundtrackVolume(page), 'the score drops while the clip is still loading').toBeCloseTo(PREFERENCE * DUCK_RATIO, 5);
  releaseFailure();
  expect((await answered).ok(), 'the clip really was refused').toBe(false);

  await expect.poll(() => soundtrackVolume(page), 'the score comes back after the failure').toBeCloseTo(PREFERENCE, 5);
  expect(await voiceClipsPlaying(page)).toBe(0);
});
