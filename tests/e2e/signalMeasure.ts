/**
 * Turns a capture into numbers: which committed file it is, and the gain the player applied to
 * that file over time. Shared by the `signal-*.audio.ts` specs.
 */
import type { Page, TestInfo } from '@playwright/test';
import { FADE_IN_MS } from '../../src/app/musicController';
import { boot, dismissBoot, expect } from './helpers';
import { align, gainEnvelope, mono, type Alignment } from '../audio/dsp';
import { assetPath, installSignalTap, playing, reference, SAMPLE_RATE, signalTapReady, type Capture } from './signalTap';

/** Envelope resolution: 5 ms, a fifth of one volume-ramp step. */
export const BLOCK = 240;
export const BLOCK_MS = BLOCK / SAMPLE_RATE * 1000;
/** How far from where the element said it was the alignment looks: the hint is read on the main
 *  thread, a few render quanta after the sample it describes. */
const SEARCH = Math.round(0.3 * SAMPLE_RATE);
const LEAD_SECONDS = 0.5;

export interface Matched extends Alignment { signal: Float32Array; reference: Float32Array; envelope: Float64Array; asset: string }

/** Match a capture against a committed file: by default the one its element was built from. */
export async function matched(page: Page, capture: Capture, asset = assetPath(capture.source)): Promise<Matched> {
  if (!capture.audible) throw new Error('Nothing but zeros was captured from ' + capture.source);
  const signal = mono(capture.left, capture.right);
  const startsAt = capture.audible.mediaSeconds - (capture.audible.frame - capture.startFrame) / SAMPLE_RATE;
  const from = Math.max(0, startsAt - LEAD_SECONDS);
  const samples = await reference(page, asset, from, signal.length / SAMPLE_RATE + 2 * LEAD_SECONDS);
  const found = align(signal, samples, Math.round((startsAt - from) * SAMPLE_RATE), SEARCH);
  return { ...found, signal, reference: samples, envelope: gainEnvelope(signal, samples, found.offset, BLOCK), asset };
}

/**
 * Keep a measured number on the test, as an annotation. Playwright's JSON and HTML reporters
 * carry annotations, so a JSON-reporter run yields every number (docs/TESTING.md).
 */
export function report(info: TestInfo, name: string, value: number, unit: string): void {
  info.annotations.push({ type: 'signal', description: name + ' = ' + (Number.isFinite(value) ? value.toFixed(2) : String(value)) + ' ' + unit });
}

/** A save in each phase, by phase number: the same six the element-level score specs use. */
export const PHASE_FIXTURES = ['tick-0', 'phase-1-widgets', 'phase-2-unlocked', 'wild-shard-encounter-p3', 'shard-drift-quirk-p4', 'phase5-midgame'];
/** `boot(..., { audio: true })` stores this music level. */
export const PREFERENCE = 0.3;
/** How long a level is left alone before it is called resting. */
export const REST_MS = 400;
/**
 * What separates a ramp from a step in these specs. At rest a ramp is a staircase of single
 * volume writes, 25 ms apart. When the main thread is busy (a first start, a purchase, a loaded
 * machine) late timer ticks land together: four writes in one 5 ms block were measured on a
 * busy machine, and the whole ramp ran up to 18% long. So a ramp may take a jump of up to half
 * its move and up to twice its nominal time; a step is the whole move at once.
 */
export const LARGEST_RAMP_JUMP = 0.5;
export const LONGEST_RAMP = 2;
/** A score element that produced samples. */
export const isScore = (capture: Capture): boolean => capture.source.includes('/audio/music/') && capture.audible !== null;

/** Boot with the score on at 30%, start it with a press on nothing, and let the fade-in finish. */
export async function startScore(page: Page, fixture: string): Promise<void> {
  await installSignalTap(page);
  await boot(page, fixture, { audio: true, realTimers: true });
  await signalTapReady(page);
  await dismissBoot(page);
  await page.getByTestId('terminal-screen').click({ position: { x: 2, y: 2 } });
  await expect.poll(() => playing(page, '/audio/music/')).toBe(1);
  await page.waitForTimeout(FADE_IN_MS + 2 * REST_MS);
}

/** Index of the first non-zero sample and one past the last, or an empty span. */
export function span(capture: Capture): { from: number; to: number } {
  let from = 0; let to = capture.left.length;
  while (from < to && capture.left[from] === 0 && capture.right[from] === 0) from++;
  while (to > from && capture.left[to - 1] === 0 && capture.right[to - 1] === 0) to--;
  return { from, to };
}
