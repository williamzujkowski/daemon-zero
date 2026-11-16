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
 *
 * Levels move by ramp, and `boot()` leaves the page clock paused, so a ramp stands still until
 * the clock is run. That is used rather than worked around: the level is read while the ramp
 * is still pending (proving it is not a step), then one ramp step at a time on the way.
 */
import { test as bare } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DUCK_RAMP_MS, DUCK_RATIO, FADE_IN_MS } from '../../src/app/musicController';
import { boot, expect, observeMusicMedia, restingSoundtrackVolume, sampleScore, soundtrackVolume, test, voiceClipsPlaying, type ScoreSample } from './helpers';

// `boot(..., { audio: true })` seeds this preference; the test asserts against it, not a guess.
const PREFERENCE = 0.3;
const DUCKED = PREFERENCE * DUCK_RATIO;

/** Runs the clock a whole duck per look, so a poll waits on the event that starts a ramp and
 *  never on the ramp: whatever was pending at a look has landed by the time it is read. */
function afterRamp(page: Page): () => Promise<number | null> {
  return async () => { await page.clock.runFor(DUCK_RAMP_MS); return soundtrackVolume(page); };
}

/** One score throughout, at least one level strictly between the ends, never a step backwards,
 *  and the last level exactly the target. */
function expectRamp(samples: ScoreSample[], from: number, to: number): void {
  const levels = samples.map((sample) => sample.volume ?? Number.NaN);
  expect(samples.every((sample) => sample.active === 1), 'exactly one score element throughout').toBe(true);
  expect(levels.filter((level) => level > Math.min(from, to) && level < Math.max(from, to)).length, 'passes through intermediate levels').toBeGreaterThan(0);
  expect(levels.every((level, index) => index === 0 || (to < from ? level <= (levels[index - 1] ?? 0) : level >= (levels[index - 1] ?? 0))), 'monotonic: ' + levels.join(', ')).toBe(true);
  expect(levels.at(-1), 'ends exactly on the target').toBe(to);
}

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
  await expect.poll(() => soundtrackVolume(page), 'the score starts silent and waits for its fade-in').toBe(0);
  expectRamp(await sampleScore(page, FADE_IN_MS), 0, PREFERENCE);
  await expect.poll(() => soundtrackVolume(page), 'the score plays at the preference level first').toBeCloseTo(PREFERENCE, 5);
  expect(await voiceClipsPlaying(page)).toBe(0);

  await read.click();
  await expect.poll(() => voiceClipsPlaying(page), 'the clip is really talking').toBe(1);
  expect(await soundtrackVolume(page), 'the duck is a ramp: nothing has moved before the clock does').toBe(PREFERENCE);
  expectRamp(await sampleScore(page, DUCK_RAMP_MS), PREFERENCE, DUCKED);
  await expect.poll(() => soundtrackVolume(page), 'the score drops under the voice').toBeCloseTo(DUCKED, 5);

  // No seek and no stop: the clip is left to finish, because the natural ending is the path a
  // player takes and the one a mock cannot stand in for.
  await expect.poll(() => voiceClipsPlaying(page), { message: 'the clip runs out', timeout: 30_000 }).toBe(0);
  expect(await soundtrackVolume(page), 'the return is a ramp too').toBe(DUCKED);
  expectRamp(await sampleScore(page, DUCK_RAMP_MS), DUCKED, PREFERENCE);
  await expect.poll(() => soundtrackVolume(page), 'the score comes back').toBeCloseTo(PREFERENCE, 5);
});

test('the resting-level helper waits out a ramp instead of returning a level in flight', async ({ page }) => {
  // The live journey takes its duck baseline from `restingSoundtrackVolume` on a clock that
  // runs by itself. A baseline read mid-ramp makes it wait for a level the score never lands
  // on, so this calls the real helper at the two worst moments: just after a start and just
  // after a duck begins.
  await observeMusicMedia(page);
  await boot(page, 'decoded-omen', { audio: true });
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  const read = page.getByTestId('speech-read');
  await expect(read).toBeVisible();
  // The journey's conditions: the page clock runs in real time, so ramps move unprompted.
  await page.clock.resume();
  await page.getByTestId('terminal-screen').click({ position: { x: 2, y: 2 } });
  await expect.poll(() => soundtrackVolume(page), 'a score exists').not.toBeNull();
  expect(await restingSoundtrackVolume(page), 'not 0 from just after the start, nor a level on the way up').toBe(PREFERENCE);
  await read.click();
  expect(await restingSoundtrackVolume(page), 'not a level on the way down').toBe(DUCKED);
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
  await expect.poll(() => soundtrackVolume(page), 'the score starts silent and waits for its fade-in').toBe(0);
  await page.clock.runFor(FADE_IN_MS);
  await expect.poll(() => soundtrackVolume(page), 'the score plays at the preference level first').toBeCloseTo(PREFERENCE, 5);

  const answered = page.waitForResponse((response) => response.url().includes('/voice/vibration/'));
  await read.click();
  await expect.poll(afterRamp(page), 'the score drops while the clip is still loading').toBeCloseTo(DUCKED, 5);
  // At rest on the ducked level: more clock moves nothing, so the return below is the failure's doing.
  await page.clock.runFor(DUCK_RAMP_MS);
  expect(await soundtrackVolume(page)).toBe(DUCKED);
  releaseFailure();
  expect((await answered).ok(), 'the clip really was refused').toBe(false);

  await expect.poll(afterRamp(page), 'the score comes back after the failure').toBeCloseTo(PREFERENCE, 5);
  expect(await voiceClipsPlaying(page)).toBe(0);
});
