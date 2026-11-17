/**
 * Starts, stops and swaps of the score, as rendered samples: a phase change never sounds two
 * scores at once, music-off and the ending fade out and then leave exact silence, and volume 0
 * is exact silence. The loop seam is in signal-loops.audio-full.ts.
 *
 * Clock: real browser timers (`realTimers`), so ramps and audio share real time.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import tracks from '../../assets/audio/music/tracks.json';
import { FADE_IN_MS, FADE_OUT_MS } from '../../src/app/musicController';
import { RAMP_STEP_MS } from '../../src/app/volumeRamp';
import { median, peak, ramp, toDb } from '../audio/dsp';
import { boot, dismissBoot, expect, test } from './helpers';
import { BLOCK, BLOCK_MS, isScore as music, LARGEST_RAMP_JUMP, LONGEST_RAMP, matched, PREFERENCE, report, REST_MS, span, startScore } from './signalMeasure';
import { assetPath, captured, installSignalTap, playing, SAMPLE_RATE, signalFrame, signalTapReady } from './signalTap';

const lead = Math.round(REST_MS / 1000 * SAMPLE_RATE);

test('a phase change never renders two scores at once: the old one is cut, then the new one fades in', async ({ page }, info) => {
  await startScore(page, 'guest-exit-ready');
  const node = [...CONTENT.nodes.values()].find((entry) => entry.effects.unlocksPhase === 1);
  if (!node) throw new Error('Missing phase transition');
  const from = await signalFrame(page) - lead;
  await page.getByTestId('node-' + node.id + '-unlock').click();
  await dismissBoot(page);
  await expect.poll(() => playing(page, '/audio/music/phase-1/')).toBe(1);
  await page.waitForTimeout(FADE_IN_MS + 2 * REST_MS);
  const result = await captured(page, from);
  const scores = result.elements.filter(music);
  expect(scores.map((score) => assetPath(score.source)), 'two score elements, in order').toEqual([tracks[0]?.path.replace('assets/', ''), tracks[1]?.path.replace('assets/', '')]);
  const [old, next] = scores;
  if (!old || !next) throw new Error('Expected two captured scores.');
  const leaving = span(old); const arriving = span(next);

  // Sample-exact: every frame where the new score has signal comes after the old score's last.
  let both = 0;
  for (let at = 0; at < old.left.length; at++) if ((old.left[at] !== 0 || old.right[at] !== 0) && (next.left[at] !== 0 || next.right[at] !== 0)) both += 1;
  report(info, 'phase change: samples where both scores have signal', both, 'samples');
  report(info, 'phase change: silence between the old score and the new', (arriving.from - leaving.to) / SAMPLE_RATE * 1000, 'ms');
  expect(both, 'never two scores at once').toBe(0);
  expect(arriving.from, 'the new score starts after the old one stopped').toBeGreaterThanOrEqual(leaving.to);

  const before = await matched(page, old);
  expect(before.correlation, 'the old signal is the phase 0 file').toBeGreaterThan(0.999);
  const lastBlock = Math.floor(leaving.to / BLOCK) - 1;
  report(info, 'phase change: old score gain in its last 5 ms (a cut, not a fade)', toDb(before.envelope[lastBlock - 1] ?? Number.NaN), 'dB');
  expect(toDb(median(before.envelope, lastBlock - 10, lastBlock)), 'cut from the full preference level').toBeCloseTo(toDb(PREFERENCE), 1);

  const after = await matched(page, next);
  expect(after.correlation, 'the new signal is the phase 1 file').toBeGreaterThan(0.999);
  const fade = ramp(after.envelope, 0, PREFERENCE, BLOCK_MS);
  if (!fade) throw new Error('The new score never reached the preference level.');
  report(info, 'phase change: new score fade-in', fade.durationMs, 'ms');
  expect(fade.reversals).toBe(0);
  expect(fade.largestStep, 'a ramp, not a step').toBeLessThanOrEqual(LARGEST_RAMP_JUMP);
  expect(fade.durationMs).toBeGreaterThanOrEqual(FADE_IN_MS * 0.5);
  expect(fade.durationMs).toBeLessThanOrEqual(FADE_IN_MS * LONGEST_RAMP);
  // The output is those two and nothing else.
  expect(Math.max(peak(result.mix.left, leaving.to, arriving.from), peak(result.mix.right, leaving.to, arriving.from)), 'the gap is silence').toBe(0);
});

/** A fade-out to nothing: staircase down from the preference level, then exact zeros in the output. */
async function expectFadeOut(page: Page, from: number, label: string, info: Parameters<typeof report>[0]): Promise<void> {
  await expect.poll(() => playing(page, '/audio/music/'), 'the player is released').toBe(0);
  await page.waitForTimeout(REST_MS);
  const result = await captured(page, from);
  const score = result.elements.filter(music).at(-1);
  if (!score) throw new Error('No score was captured.');
  const match = await matched(page, score);
  const fade = ramp(match.envelope, PREFERENCE, 0, BLOCK_MS);
  if (!fade) throw new Error('The score never reached silence.');
  report(info, label + ': fade-out, first change to silence', fade.durationMs, 'ms');
  report(info, label + ': fade-out largest single step', fade.largestStep * PREFERENCE, 'gain');
  expect(toDb(median(match.envelope, 0, fade.startBlock)), 'at the preference level first').toBeCloseTo(toDb(PREFERENCE), 1);
  expect(fade.reversals, 'downwards only').toBe(0);
  expect(fade.largestStep, 'a ramp, not a step').toBeLessThanOrEqual(LARGEST_RAMP_JUMP);
  // The first write lands one step after the press and the last on the deadline, and with
  // twenty steps the first and last each sit on the 5% edge of "at the level": 425 to 475 ms.
  expect(fade.durationMs).toBeGreaterThanOrEqual(FADE_OUT_MS - 4 * RAMP_STEP_MS);
  expect(fade.durationMs).toBeLessThanOrEqual(FADE_OUT_MS * LONGEST_RAMP);
  const silentFrom = span(score).to;
  expect(result.mix.left.length - silentFrom, 'a stretch after the fade was captured').toBeGreaterThan(SAMPLE_RATE / 5);
  expect(Math.max(peak(result.mix.left, silentFrom), peak(result.mix.right, silentFrom)), 'then exact silence').toBe(0);
}

test('music off fades the score out and leaves silence; volume 0 is silence', async ({ page }, info) => {
  await startScore(page, 'tick-0');
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  const from = await signalFrame(page) - lead;
  await page.getByTestId('music-toggle').click();
  await expectFadeOut(page, from, 'music off', info);

  // Back on, then down to zero with the control: the player stays, its signal is zeros.
  await page.getByTestId('music-toggle').click();
  await expect.poll(() => playing(page, '/audio/music/')).toBe(1);
  await page.waitForTimeout(FADE_IN_MS + REST_MS);
  for (let presses = 0; presses < 3; presses++) await page.getByTestId('music-quieter').click();
  await expect(page.getByTestId('music-volume')).toHaveText('Music volume 0%');
  const zeroed = await signalFrame(page);
  await page.waitForTimeout(REST_MS);
  const quiet = await captured(page, zeroed + SAMPLE_RATE / 20);
  expect(await playing(page, '/audio/music/'), 'still playing, at zero').toBe(1);
  expect(quiet.mix.quanta).toBeGreaterThan(50);
  expect(Math.max(peak(quiet.mix.left), peak(quiet.mix.right)), 'volume 0 is exact silence').toBe(0);
  await page.getByTestId('music-louder').click();
  await page.waitForTimeout(REST_MS);
  expect(peak((await captured(page, await signalFrame(page) - lead / 2)).mix.left), 'and one step up is signal again').toBeGreaterThan(0);
});

test('the ending fades the score out and leaves silence', async ({ page }, info) => {
  await startScore(page, 'evaluation-ready');
  const ending = [...CONTENT.nodes.values()].find((entry) => entry.effects.forcesEnding !== undefined);
  if (!ending) throw new Error('Missing an ending node');
  const from = await signalFrame(page) - lead;
  await page.getByTestId('node-' + ending.id + '-unlock').click();
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  await expectFadeOut(page, from, 'ending', info);
});

test('a score whose file arrives late still fades in', async ({ page }, info) => {
  // Known limit, kept as an expected failure so that fixing it turns this case red until the
  // annotation is removed. The fade-in is timed from the `play()` request, not from the first
  // sample, so whatever part of it elapses while the file loads is never rendered; a file that
  // takes longer than FADE_IN_MS starts at full level, as a step. docs/VOICE-CLIPS.md, "Limits".
  test.fail(true, 'the fade-in runs on the request, not on the first sample');
  const delayMs = FADE_IN_MS + 200;
  await page.route('**/audio/music/**/*.mp3', async (route) => { await new Promise((resolve) => { setTimeout(resolve, delayMs); }); await route.continue(); });
  await installSignalTap(page);
  await boot(page, 'tick-0', { audio: true, realTimers: true });
  await signalTapReady(page);
  await dismissBoot(page);
  await page.getByTestId('terminal-screen').click({ position: { x: 2, y: 2 } });
  await expect.poll(async () => (await captured(page)).elements[0]?.audible ?? null, { timeout: 10_000 }).not.toBeNull();
  await page.waitForTimeout(FADE_IN_MS + REST_MS);
  const score = (await captured(page)).elements.filter(music).at(-1);
  if (!score) throw new Error('No score was captured.');
  const fade = ramp((await matched(page, score)).envelope, 0, PREFERENCE, BLOCK_MS);
  if (!fade) throw new Error('The score never reached the preference level.');
  report(info, 'fade-in when the file arrives ' + String(delayMs) + ' ms after play()', fade.durationMs, 'ms');
  report(info, 'largest single step of that start', fade.largestStep * PREFERENCE, 'gain');
  expect(fade.durationMs).toBeGreaterThanOrEqual(FADE_IN_MS * 0.5);
});
