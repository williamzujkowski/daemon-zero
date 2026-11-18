/**
 * Turns a capture into numbers: which committed file it is, and the gain the player applied to
 * that file over time. Shared by the `signal-*.audio.ts` specs.
 */
import type { Page, TestInfo } from '@playwright/test';
import { FADE_IN_MS } from '../../src/app/musicController';
import { OUTPUT_SCALE } from '../../src/app/outputLevel';
import { RAMP_STEP_MS } from '../../src/app/volumeRamp';
import { boot, dismissBoot, expect } from './helpers';
import { align, clockedRamp, gainEnvelope, mono, type Alignment, type ClockedRamp, type RenderClock } from '../audio/dsp';
import { assetPath, installSignalTap, playing, reference, SAMPLE_RATE, settle, signalTapReady, type Capture, type RenderedAt } from './signalTap';

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
/** The gain that preference asks the player for: the output scale keeps headroom for speech. */
export const LEVEL = PREFERENCE * OUTPUT_SCALE;
/** How long a level is left alone before it is called resting. */
export const REST_MS = 400;
/**
 * What separates a ramp from a step in these specs. At rest a ramp is a staircase of single
 * volume writes, 25 ms apart, and a busy main thread only stretches it: the browser drops the
 * timer ticks it missed and the ramp counts steps (measured: a ramp ran up to 18% long). So a
 * ramp may take up to twice its nominal time, and between two neighbouring blocks a jump of up
 * to half its move; a step is the whole move at once.
 *
 * More than half arrives at once only when the output stopped pulling samples (#244): the ramp
 * goes on writing in real time and every write made meanwhile lands at one sample instant. That
 * is measured, not assumed: `rampAllowance` grows past this floor by one write per
 * `RAMP_STEP_MS` the render clock stood still, and durations are read on that clock.
 */
export const LARGEST_RAMP_JUMP = 0.5;
export const LONGEST_RAMP = 2;

/**
 * The most of a ramp of `durationMs` that may arrive between two neighbouring blocks rendered
 * `elapsedMs` apart: `LARGEST_RAMP_JUMP`, or one write per `RAMP_STEP_MS` of render time plus two
 * (a late tick and the on-time one after it) when that is more.
 */
export function rampAllowance(durationMs: number): (elapsedMs: number) => number {
  const steps = Math.ceil(durationMs / RAMP_STEP_MS);
  return (elapsedMs) => Math.max(LARGEST_RAMP_JUMP, (Math.floor(elapsedMs / RAMP_STEP_MS) + 2) / steps);
}

/** When each `BLOCK` of a capture was rendered, from `firstBlock` on, as `clockedRamp` reads it. */
export function renderClock(renderedAt: RenderedAt, capture: Capture, firstBlock = 0): RenderClock {
  const at = (frame: number): number => renderedAt.ms[Math.floor((frame - renderedAt.from) / 128)] ?? Number.NaN;
  const blocks = Math.max(0, Math.floor(capture.left.length / BLOCK) - firstBlock);
  const frameOf = (block: number) => capture.startFrame + (firstBlock + block) * BLOCK;
  return { first: Float64Array.from({ length: blocks }, (_, block) => at(frameOf(block))),
    last: Float64Array.from({ length: blocks }, (_, block) => at(frameOf(block) + BLOCK - 1)) };
}

/** A ramp of nominal `durationMs` in an envelope, with the render clock beside it. */
export function rampOf(envelope: Float64Array, clock: RenderClock, from: number, to: number, durationMs: number): ClockedRamp | null {
  return clockedRamp(envelope, clock, from, to, BLOCK_MS, rampAllowance(durationMs));
}

/** Keep a ramp's numbers on the test: its length in samples and on the render clock, and the
 *  longest the renderer stood still inside it. */
export function reportRamp(info: TestInfo, label: string, move: ClockedRamp): void {
  report(info, label + ', first change to resting level, in samples', move.durationMs, 'ms');
  report(info, label + ', first change to resting level, on the render clock', move.renderMs, 'ms');
  report(info, label + ', longest render time across two neighbouring blocks', move.longestGapMs, 'ms');
}
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
  await settle(page, FADE_IN_MS + 2 * REST_MS);
}

/** Index of the first non-zero sample and one past the last, or an empty span. */
export function span(capture: Capture): { from: number; to: number } {
  let from = 0; let to = capture.left.length;
  while (from < to && capture.left[from] === 0 && capture.right[from] === 0) from++;
  while (to > from && capture.left[to - 1] === 0 && capture.right[to - 1] === 0) to--;
  return { from, to };
}
