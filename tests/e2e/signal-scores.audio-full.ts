/**
 * Each phase score, as rendered samples: silent before the first gesture, then the right file,
 * faded in, at the level the preference asks for, without clipping.
 *
 * "The right file" is decided by waveform: the capture is correlated with the committed file
 * for that phase (decoded by the same browser from the repository's bytes) and, as a control,
 * with a neighbouring phase's file, which must not match.
 *
 * Clock: `boot()` installs and pauses Playwright's page clock; these cases resume it, so page
 * timers (the ramp's 25 ms steps) run in real time alongside the audio clock the capture is on.
 */
import tracks from '../../assets/audio/music/tracks.json';
import { FADE_IN_MS } from '../../src/app/musicController';
import { RAMP_STEP_MS } from '../../src/app/volumeRamp';
import { correlation, median, peak, ramp, rms, toDb, truePeak } from '../audio/dsp';
import { boot, dismissBoot, expect, test } from './helpers';
import { BLOCK, BLOCK_MS, LARGEST_RAMP_JUMP, LONGEST_RAMP, matched, PHASE_FIXTURES, PREFERENCE, report } from './signalMeasure';
import { assetPath, captured, installSignalTap, SAMPLE_RATE, signalTapReady } from './signalTap';

const LISTEN_MS = 1800;
/** One volume write, as a fraction of the whole fade. */
const STEP = RAMP_STEP_MS / FADE_IN_MS;

for (const track of tracks) test('phase ' + String(track.phase) + ' renders its own score, faded in to the preference level, unclipped', async ({ page }, info) => {
  const name = 'phase ' + String(track.phase);
  await installSignalTap(page);
  await boot(page, PHASE_FIXTURES[track.phase], { audio: true, realTimers: true });
  await signalTapReady(page);

  // Music is on by default but nothing has been pressed: the output is zeros, and measured as such.
  await page.waitForTimeout(300);
  const before = await captured(page);
  expect(before.elements, 'no player before a gesture').toHaveLength(0);
  expect(before.mix.quanta, 'the output tap was running').toBeGreaterThan(50);
  expect(Math.max(peak(before.mix.left), peak(before.mix.right)), 'silence before the first gesture').toBe(0);

  await dismissBoot(page);
  await page.getByTestId('terminal-screen').click({ position: { x: 2, y: 2 } });
  await expect.poll(async () => (await captured(page)).elements[0]?.audible ?? null, 'the score becomes audible').not.toBeNull();
  await page.waitForTimeout(LISTEN_MS);
  const { elements, mix } = await captured(page);
  expect(elements, 'one score element').toHaveLength(1);
  const score = elements[0];
  if (!score) throw new Error('No score was captured.');
  expect(assetPath(score.source)).toBe(track.path.replace('assets/', ''));

  const own = await matched(page, score);
  const other = await matched(page, score, (tracks[(track.phase + 1) % tracks.length]?.path ?? '').replace('assets/', ''));
  // The fade-in: from zero to the preference level, in steps, upwards only.
  const fade = ramp(own.envelope, 0, PREFERENCE, BLOCK_MS);
  if (!fade) throw new Error('No fade-in was found in the gain envelope.');
  report(info, name + ' fade-in, first audible sample to preference level', fade.durationMs, 'ms');
  report(info, name + ' fade-in largest single step', fade.largestStep * PREFERENCE, 'gain');
  expect(fade.reversals, 'upwards only').toBe(0);
  report(info, name + ' fade-in largest single step, in volume writes', fade.largestStep / STEP, 'steps');
  expect(fade.largestStep, 'a ramp in the signal, not a step').toBeLessThanOrEqual(LARGEST_RAMP_JUMP);
  // The ramp starts when `play()` is asked for, and the file's first samples arrive a step or
  // more later, so the audible part is shorter than the constant by however long loading took.
  expect(fade.durationMs).toBeGreaterThanOrEqual(FADE_IN_MS * 0.5);
  expect(fade.durationMs).toBeLessThanOrEqual(FADE_IN_MS * LONGEST_RAMP);

  const steadyFrom = (fade.endBlock + 2) * BLOCK;
  // Over everything at rest, not just the window the alignment used: a bass note can line up
  // with another track for a tenth of a second, and cannot for a second.
  const ownMatch = correlation(own.signal, own.reference, own.offset, steadyFrom);
  const otherMatch = correlation(own.signal, other.reference, other.offset, steadyFrom);
  report(info, name + ' correlation with its own file', ownMatch, '(1 = identical)');
  report(info, name + ' correlation with the next phase file', otherMatch, '(1 = identical)');
  expect(ownMatch, 'the samples are this phase file').toBeGreaterThan(0.999);
  expect(Math.abs(otherMatch), 'and not another score').toBeLessThan(0.3);
  const gain = median(own.envelope, fade.endBlock + 2);
  report(info, name + ' steady gain applied to the file', toDb(gain), 'dB');
  expect(toDb(gain), 'the preference level, on the signal').toBeCloseTo(toDb(PREFERENCE), 1);
  expect(steadyFrom, 'at least half a second at rest was captured').toBeLessThan(score.left.length - SAMPLE_RATE / 2);

  const level = toDb(rms(own.signal, steadyFrom));
  const samplePeak = Math.max(peak(score.left, steadyFrom), peak(score.right, steadyFrom));
  const interSample = Math.max(truePeak(score.left, steadyFrom), truePeak(score.right, steadyFrom));
  report(info, name + ' level at rest', level, 'dBFS RMS');
  report(info, name + ' sample peak at rest', toDb(samplePeak), 'dBFS');
  report(info, name + ' true-peak estimate at rest', toDb(interSample), 'dBTP');
  expect(level, 'audible, not a trace').toBeGreaterThan(-60);
  expect(interSample, 'no clipping').toBeLessThan(1);
  // With one source the output mix is that source.
  expect(Math.max(peak(mix.left), peak(mix.right))).toBeCloseTo(Math.max(peak(score.left), peak(score.right)), 6);
});
