/**
 * A spoken transmission over the score, as rendered samples.
 *
 * The two sources are captured separately (one tap per media element, on one sample clock), so
 * the score's own level can be read while the clip talks over it: its gain against the phase
 * file before, during and after, and the shape of the move between them. The clip's level is
 * read the same way against its own file. The output mix is captured as well and must equal the
 * sum of the two, sample for sample, so nothing reaches the output that was not measured.
 *
 * Clock: real browser timers throughout (`realTimers`), so the 25 ms ramp steps and the audio
 * run on the same real time. Nothing here says how any of it sounds.
 */
import type { Page, TestInfo } from '@playwright/test';
import { DUCK_RAMP_MS, DUCK_RATIO, FADE_IN_MS } from '../../src/app/musicController';
import { RAMP_STEP_MS } from '../../src/app/volumeRamp';
import { median, mono, peak, ramp, rms, sum, toDb, truePeak } from '../audio/dsp';
import { boot, expect, test } from './helpers';
import { BLOCK, BLOCK_MS, LARGEST_RAMP_JUMP, LONGEST_RAMP, matched, report, REST_MS, span, type Matched } from './signalMeasure';
import { assetPath, captured, installSignalTap, playing, SAMPLE_RATE, signalFrame, signalTapReady, type Capture, type Captured } from './signalTap';

const blocksOf = (ms: number) => Math.round(ms / BLOCK_MS);

async function openSensors(page: Page): Promise<void> {
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  await expect(page.getByTestId('speech-read')).toBeVisible();
}

/** Press READ, let the clip run out by itself, and return everything rendered from `lead` before the press. */
async function readThrough(page: Page, leadMs: number): Promise<Captured & { pressed: number }> {
  const pressed = await signalFrame(page);
  await page.getByTestId('speech-read').click();
  await expect.poll(() => playing(page, '/voice/'), 'the clip is talking').toBe(1);
  await expect.poll(() => playing(page, '/voice/'), { message: 'the clip runs out', timeout: 30_000 }).toBe(0);
  await page.waitForTimeout(DUCK_RAMP_MS + REST_MS + 200);
  return { ...await captured(page, pressed - Math.round(leadMs / 1000 * SAMPLE_RATE)), pressed };
}

function find(result: Captured, kind: string): Capture {
  const found = result.elements.filter((element) => element.source.includes(kind) && element.audible !== null).at(-1);
  if (!found) throw new Error('No ' + kind + ' element produced samples.');
  return found;
}

/** The clip's gain against its own file: the speech level, on the signal. */
async function speechGain(page: Page, clip: Capture, info: TestInfo, label: string): Promise<{ gain: number; match: Matched }> {
  const match = await matched(page, clip);
  const { from, to } = span(clip);
  const gain = median(match.envelope, Math.ceil(from / BLOCK), Math.floor(to / BLOCK));
  report(info, label + ' speech gain applied to the clip file', toDb(gain), 'dB');
  report(info, label + ' speech correlation with its clip file', match.correlation, '(1 = identical)');
  expect(match.correlation, 'the samples are that clip').toBeGreaterThan(0.98);
  return { gain, match };
}

test('the score ducks under a transmission by the duck ratio, by ramps, and comes back', async ({ page }, info) => {
  const preference = 0.3;
  await installSignalTap(page);
  await boot(page, 'decoded-omen', { audio: true, realTimers: true });
  await signalTapReady(page);
  await openSensors(page);
  await page.getByTestId('terminal-screen').click({ position: { x: 2, y: 2 } });
  await expect.poll(() => playing(page, '/audio/music/')).toBe(1);
  await page.waitForTimeout(FADE_IN_MS + 2 * REST_MS);

  const result = await readThrough(page, REST_MS);
  const score = find(result, '/audio/music/'); const clip = find(result, '/voice/');
  expect(score.startFrame, 'both captures share one timeline').toBe(clip.startFrame);
  const music = await matched(page, score);
  expect(music.correlation).toBeGreaterThan(0.999);
  const talking = span(clip);
  // Which passage this is matters to the absolute levels below, so the run says so.
  info.annotations.push({ type: 'signal', description: 'sources = ' + assetPath(clip.source) + ' over ' + assetPath(score.source) });

  // Levels at rest: before the press, while the clip talks (after the way down), and after.
  const before = median(music.envelope, 0, blocksOf(REST_MS) - 4);
  const down = ramp(music.envelope, before, before * DUCK_RATIO, BLOCK_MS);
  if (!down) throw new Error('The score never reached the ducked level.');
  const during = median(music.envelope, down.endBlock + 2, Math.floor(talking.to / BLOCK) - 2);
  const tail = music.envelope.subarray(Math.floor(talking.to / BLOCK) - 4);
  const up = ramp(tail, during, before, BLOCK_MS);
  if (!up) throw new Error('The score never came back.');
  const after = median(tail, up.endBlock + 2);
  report(info, 'score gain before the clip', toDb(before), 'dB');
  report(info, 'score gain while the clip talks', toDb(during), 'dB');
  report(info, 'score gain after the clip', toDb(after), 'dB');
  report(info, 'duck depth on the signal', toDb(during / before), 'dB');
  expect(toDb(before)).toBeCloseTo(toDb(preference), 1);
  expect(toDb(during / before), 'DUCK_RATIO on the signal').toBeCloseTo(toDb(DUCK_RATIO), 1);
  expect(toDb(after)).toBeCloseTo(toDb(preference), 1);

  // The moves are staircases of DUCK_RAMP_MS / RAMP_STEP_MS volume writes, one way only.
  for (const [label, move] of [['down', down], ['up', up]] as const) {
    report(info, 'duck ' + label + ', first change to resting level', move.durationMs, 'ms');
    report(info, 'duck ' + label + ' largest single step, relative to the ducked level', toDb(1 + move.largestStep * (1 / DUCK_RATIO - 1)), 'dB');
    expect(move.reversals, label + ': one way only').toBe(0);
    expect(move.largestStep, label + ': a ramp, not a step').toBeLessThanOrEqual(LARGEST_RAMP_JUMP);
    // The first write lands one step after the trigger and the last on the deadline.
    expect(move.durationMs).toBeGreaterThanOrEqual(DUCK_RAMP_MS - 2 * RAMP_STEP_MS);
    expect(move.durationMs).toBeLessThanOrEqual(DUCK_RAMP_MS * LONGEST_RAMP);
  }
  // When the duck moves relative to the speech itself, which is what a listener would notice.
  report(info, 'duck starts after the first speech sample by', down.startBlock * BLOCK_MS - talking.from / SAMPLE_RATE * 1000, 'ms');
  report(info, 'score starts back after the last speech sample by', (Math.floor(talking.to / BLOCK) - 4 + up.startBlock) * BLOCK_MS - talking.to / SAMPLE_RATE * 1000, 'ms');

  // Speech against the ducked score, over the stretch where the clip has samples and the duck is down.
  const { gain } = await speechGain(page, clip, info, 'default levels:');
  expect(toDb(gain), 'the speech level, on the signal').toBeCloseTo(toDb(preference), 1);
  const from = Math.max(talking.from, (down.endBlock + 2) * BLOCK);
  const speech = toDb(rms(mono(clip.left, clip.right), from, talking.to));
  const under = toDb(rms(music.signal, from, talking.to));
  report(info, 'speech level while talking', speech, 'dBFS RMS');
  report(info, 'ducked score level under it', under, 'dBFS RMS');
  report(info, 'speech-to-music ratio during the clip', speech - under, 'dB');
  expect(speech - under, 'speech is above the ducked score').toBeGreaterThan(0);

  // The output is exactly the two sources summed, and it does not clip.
  const length = Math.min(result.mix.left.length, score.left.length, clip.left.length);
  const rebuilt = sum([score.left, clip.left], length);
  let worst = 0;
  for (let at = 0; at < length; at++) worst = Math.max(worst, Math.abs((rebuilt[at] ?? 0) - (result.mix.left[at] ?? 0)));
  expect(worst, 'the output mix is the sum of the tapped elements').toBeLessThan(1e-6);
  const mixPeak = Math.max(truePeak(result.mix.left), truePeak(result.mix.right));
  report(info, 'output mix true-peak estimate, score and speech at 30%', toDb(mixPeak), 'dBTP');
  expect(mixPeak, 'no clipping').toBeLessThan(1);
});

test('speech follows its own level and is rendered with music off', async ({ page }, info) => {
  await installSignalTap(page);
  await boot(page, 'decoded-omen', { audio: { version: 2, enabled: false, volume: 30, speechEnabled: true, speechVolume: 60 }, realTimers: true });
  await signalTapReady(page);
  await openSensors(page);
  const loud = await readThrough(page, 100);
  expect(loud.elements.filter((element) => element.source.includes('/audio/music/')), 'no score element with music off').toHaveLength(0);
  const first = find(loud, '/voice/');
  const high = await speechGain(page, first, info, 'speech 60%, music off:');
  expect(toDb(high.gain)).toBeCloseTo(toDb(0.6), 1);
  expect(toDb(rms(first.left)), 'audible signal with music off').toBeGreaterThan(-50);
  // With music off the output is the clip and nothing else, and silent once it has ended.
  const ended = span(first).to;
  expect(peak(loud.mix.left, ended + BLOCK), 'silence after the clip').toBe(0);
  expect(peak(loud.mix.left, 0, ended)).toBeCloseTo(peak(first.left), 6);

  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
  for (let presses = 0; presses < 3; presses++) await page.getByTestId('speech-quieter').click();
  await expect(page.getByTestId('speech-volume')).toHaveText('Speech volume 30%');
  await page.getByTestId('menu-close').click();
  await openSensors(page);
  const quiet = await readThrough(page, 100);
  const low = await speechGain(page, find(quiet, '/voice/'), info, 'speech 30%, music off:');
  report(info, 'speech 60% over speech 30%', toDb(high.gain / low.gain), 'dB');
  expect(toDb(high.gain / low.gain), 'half the speech level is 6.02 dB less signal').toBeCloseTo(6.02, 1);
});

test('at full music and speech levels the output mix is measured for clipping', async ({ page }, info) => {
  await installSignalTap(page);
  await boot(page, 'decoded-omen', { audio: { version: 2, enabled: true, volume: 100, speechEnabled: true, speechVolume: 100 }, realTimers: true });
  await signalTapReady(page);
  await openSensors(page);
  await page.getByTestId('terminal-screen').click({ position: { x: 2, y: 2 } });
  await expect.poll(() => playing(page, '/audio/music/')).toBe(1);
  await page.waitForTimeout(FADE_IN_MS + 2 * REST_MS);
  const result = await readThrough(page, REST_MS);
  const mixPeak = Math.max(truePeak(result.mix.left), truePeak(result.mix.right));
  const clipPeak = truePeak(find(result, '/voice/').left);
  report(info, 'speech true-peak estimate at 100%', toDb(clipPeak), 'dBTP');
  report(info, 'output mix true-peak estimate, score and speech at 100%', toDb(mixPeak), 'dBTP');
  let over = 0;
  for (const channel of [result.mix.left, result.mix.right]) for (const sample of channel) if (Math.abs(sample) >= 1) over += 1;
  report(info, 'output mix samples at or over full scale, both at 100%', over, 'samples');
  expect(clipPeak, 'the clip alone stays under full scale').toBeLessThan(1);
});
