/**
 * A voiced feed line plays once by itself, the first time it is shown (#462), on the real build:
 * not before the player's first gesture, not while a modal is open, the game is paused or speech is
 * off, never twice, and not again after a reload. The score ducks under it as it does under READ.
 *
 * `boot()` starts every other spec with all lines heard; these pass `heard: []`, a fresh install.
 * A clip plays in real time while the page clock is paused, so "it ran out" is waited for in real
 * time, and "nothing played" is a short real-time wait followed by a look at the wire.
 */
import type { Page, Request } from '@playwright/test';
import { DUCK_RAMP_MS, DUCK_RATIO } from '../../src/app/musicController';
import { OUTPUT_SCALE } from '../../src/app/outputLevel';
import { boot, dismissBoot, expect, observeMusicMedia, scoreFlowing, soundtrackVolume, test, voiceClipsPlaying } from './helpers';

const HEARD_KEY = 'daemon-zero.voice-heard.v1';
/** Long enough for a clip that was going to be asked for to be asked for; the request is the evidence. */
const QUIET_MS = 1500;

function voiceRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request: Request) => { if (request.url().includes('/voice/')) seen.push(request.url()); });
  return seen;
}
async function sensors(page: Page): Promise<void> {
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
}
/** A press on nothing in particular: the first gesture on either tier, opening no control. */
async function touch(page: Page): Promise<void> {
  await page.getByTestId('terminal-screen').click({ position: { x: 2, y: 2 } });
}
async function heardSlot(page: Page): Promise<string[]> {
  return page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? '{"heard":[]}') as { heard: string[] }).heard, HEARD_KEY);
}

test('the first showing plays once after the first gesture, never again, and not after a reload', async ({ page }) => {
  const requests = voiceRequests(page);
  await observeMusicMedia(page);
  await boot(page, 'decoded-omen', { audio: true, heard: [] });
  await sensors(page);
  await expect(page.getByTestId('decoded-speech')).toBeVisible();
  // The phone's tab press was a gesture already; a desktop boot has had none until now.
  await touch(page);
  await expect.poll(() => requests.length, 'the shown line is asked for once the player has touched the game').toBe(1);
  // The export names each asset with a content hash after the id.
  const line = /\/voice\/vibration\/(ambient_\d+)[^/]*\.mp3$/.exec(requests[0] ?? '')?.[1] ?? '';
  expect(line, requests[0]).not.toBe('');
  await expect.poll(() => voiceClipsPlaying(page), 'and it really talks').toBe(1);
  await expect(page.getByTestId('speech-stop')).toBeVisible();
  await expect.poll(() => voiceClipsPlaying(page), { message: 'the clip runs out by itself', timeout: 30_000 }).toBe(0);
  await expect(page.getByTestId('speech-read')).toBeVisible();
  expect(await heardSlot(page)).toEqual([line]);
  // The same line, still on screen, is never played again on its own.
  await touch(page);
  await page.waitForTimeout(QUIET_MS);
  expect(requests).toHaveLength(1);
  // Nor after a reload: the heard set is stored, so the line is shown and stays quiet.
  await page.reload();
  await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  await sensors(page); await touch(page);
  await page.waitForTimeout(QUIET_MS);
  expect(await voiceClipsPlaying(page)).toBe(0);
  expect(requests).toHaveLength(1);
  // READ still replays it on demand.
  await page.getByTestId('speech-read').click();
  await expect.poll(() => requests.length).toBe(2);
});

test('the score ducks under a line that plays by itself, as it does under READ', async ({ page }) => {
  await observeMusicMedia(page);
  // One gesture starts both: the score fades in to the ducked level, because a line is already talking.
  await boot(page, 'decoded-omen', { audio: true, heard: [] });
  await sensors(page); await touch(page);
  await expect.poll(() => voiceClipsPlaying(page), 'the line plays by itself').toBe(1);
  await scoreFlowing(page);
  await expect.poll(async () => { await page.clock.runFor(DUCK_RAMP_MS); return soundtrackVolume(page); }, 'the score sits ducked under it')
    .toBeCloseTo(0.3 * OUTPUT_SCALE * DUCK_RATIO, 5);
  await expect.poll(() => voiceClipsPlaying(page), { message: 'the clip runs out', timeout: 30_000 }).toBe(0);
  await expect.poll(async () => { await page.clock.runFor(DUCK_RAMP_MS); return soundtrackVolume(page); }, 'and the score comes back')
    .toBeCloseTo(0.3 * OUTPUT_SCALE, 5);
});

test('a READ that replaces a line playing by itself keeps the score ducked until nothing talks', async ({ page }) => {
  await observeMusicMedia(page);
  // A returned cryo save: the feed and a recorded transmission are both on SENSORS.
  await boot(page, 'cryo-preserved-returned', { audio: true, heard: [] });
  await dismissBoot(page);
  await sensors(page); await touch(page);
  await expect.poll(() => voiceClipsPlaying(page), 'the feed line plays by itself').toBe(1);
  await scoreFlowing(page);
  const ducked = 0.3 * OUTPUT_SCALE * DUCK_RATIO;
  const afterRamp = async () => { await page.clock.runFor(DUCK_RAMP_MS); return soundtrackVolume(page); };
  await expect.poll(afterRamp, 'ducked under the line').toBeCloseTo(ducked, 5);
  // READ on the record while the line still talks: the record's clip replaces the line's.
  const toggle = page.getByTestId('reference-recorded-transmissions');
  await toggle.click();
  const read = page.locator('[data-testid^="recorded-speech-read-"]').first();
  await read.click();
  await expect(page.locator('[data-testid^="recorded-speech-stop-"]').first(), 'the record is talking').toBeVisible();
  // Through the replacement and for a stretch of the record, the score never comes back up.
  for (let look = 0; look < 6; look++) {
    expect(await voiceClipsPlaying(page), 'one clip, the record').toBe(1);
    expect(await afterRamp(), 'still ducked under the record').toBeCloseTo(ducked, 5);
  }
  // STOP on the record: if nothing else talks, the score comes back.
  await page.locator('[data-testid^="recorded-speech-stop-"]').first().click();
  await expect.poll(async () => (await voiceClipsPlaying(page)) === 0 ? afterRamp() : null, { message: 'back up once every voice is silent', timeout: 30_000 })
    .toBeCloseTo(0.3 * OUTPUT_SCALE, 5);
});

test('a line the feed rotates to behind an open menu waits for it to close, then plays', async ({ page }) => {
  const requests = voiceRequests(page);
  await observeMusicMedia(page);
  await boot(page, 'decoded-omen', { audio: true, heard: [] });
  await sensors(page); await touch(page);
  // The first line plays and runs out; then the menu opens over the feed.
  await expect.poll(() => requests.length).toBe(1);
  await expect.poll(() => voiceClipsPlaying(page), { message: 'the first clip runs out', timeout: 30_000 }).toBe(0);
  const first = await page.getByTestId('decoded-speech').textContent();
  await page.getByTestId('menu-open').click();
  // Eight game seconds: the live rotation moves on to a line never heard, behind the modal.
  await page.clock.runFor(8_000);
  await expect(page.getByTestId('decoded-speech')).not.toHaveText(first ?? '');
  await page.waitForTimeout(QUIET_MS);
  expect(requests, 'nothing plays behind a modal').toHaveLength(1);
  await page.getByTestId('menu-close').click();
  await expect.poll(() => requests.length, 'it plays once the modal closes').toBe(2);
});

test('nothing plays while speech is off or the game is paused', async ({ page }) => {
  const requests = voiceRequests(page);
  await boot(page, 'decoded-omen', { audio: { version: 2, enabled: true, volume: 30, speechEnabled: false, speechVolume: 30 }, heard: [] });
  await sensors(page); await touch(page);
  await page.waitForTimeout(QUIET_MS);
  expect(requests, 'speech off: silent').toEqual([]);
  // Speech on, but paused first: still silent until the game runs again.
  await page.getByTestId('menu-open').click();
  await page.getByTestId('menu-pause').click();
  await page.getByTestId('menu-audio').click();
  await page.getByTestId('speech-toggle').click();
  await expect(page.getByTestId('speech-toggle')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('menu-close').click();
  await sensors(page);
  await expect(page.getByTestId('run-paused')).toBeVisible();
  await page.waitForTimeout(QUIET_MS);
  expect(requests, 'paused: silent').toEqual([]);
  await page.getByTestId('menu-open').click();
  await page.getByTestId('menu-pause').click();
  await page.getByTestId('menu-close').click();
  await sensors(page);
  await expect.poll(() => requests.length, 'running again: the line on screen plays').toBe(1);
});
