/**
 * Calibrates the signal measurements against signals whose answer is known. Everything the
 * audio specs report about the game rests on these functions, so each is shown to read a
 * synthetic input correctly, and to read a step as a step.
 */
import { describe, expect, it } from 'vitest';
import { align, correlation, gainEnvelope, loudestWindow, median, mono, peak, ramp, rms, sine, sum, toDb, truePeak } from './audio/dsp';

const RATE = 48_000;
const BLOCK = 240;
const BLOCK_MS = 5;

/** Deterministic noise: the tests must not depend on Math.random. */
function noise(length: number, seed = 1): Float32Array {
  const out = new Float32Array(length);
  let state = seed;
  for (let at = 0; at < length; at++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    out[at] = state / 2 ** 31 - 1;
  }
  return out;
}

/** `reference` scaled by a gain that follows `shape(seconds)`. */
function shaped(reference: Float32Array, shape: (seconds: number) => number): Float32Array {
  return reference.map((value, at) => value * shape(at / RATE));
}

describe('level', () => {
  it('reads a sine of known amplitude as the right dBFS', () => {
    for (const amplitude of [1, 0.5, 0.25, 0.105]) {
      const tone = sine(amplitude, 1000, 1, RATE);
      expect(toDb(rms(tone))).toBeCloseTo(toDb(amplitude) - 3.0103, 3);
      expect(toDb(peak(tone))).toBeCloseTo(toDb(amplitude), 3);
    }
    expect(toDb(rms(sine(0.5, 440, 1, RATE))) - toDb(rms(sine(0.25, 440, 1, RATE)))).toBeCloseTo(6.0206, 3);
  });

  it('reads silence as zero and minus infinity, and an empty range as zero', () => {
    const silence = new Float32Array(1000);
    expect(rms(silence)).toBe(0);
    expect(peak(silence)).toBe(0);
    expect(toDb(rms(silence))).toBe(Number.NEGATIVE_INFINITY);
    expect(rms(silence, 10, 10)).toBe(0);
  });

  it('measures only the range asked for', () => {
    const signal = Float32Array.from([...sine(1, 1000, 0.1, RATE), ...new Float32Array(4800)]);
    expect(peak(signal, 4800)).toBe(0);
    expect(toDb(rms(signal, 0, 4800))).toBeCloseTo(-3.0103, 3);
  });

  it('finds an inter-sample peak that no sample reaches', () => {
    // A quarter-rate sine sampled 45 degrees off its crests: every sample is 0.707 of the peak.
    const tone = sine(1, RATE / 4, 0.05, RATE, Math.PI / 4);
    expect(peak(tone)).toBeCloseTo(Math.SQRT1_2, 3);
    expect(toDb(truePeak(tone))).toBeGreaterThan(-0.2);
    expect(toDb(truePeak(tone))).toBeLessThan(0.2);
    // And it never reads below the sample peak, or above it for a slow waveform.
    const slow = sine(0.5, 100, 0.1, RATE);
    expect(toDb(truePeak(slow))).toBeCloseTo(toDb(0.5), 2);
    expect(truePeak(new Float32Array(100))).toBe(0);
  });

  it('downmixes and sums on one timeline', () => {
    expect(Array.from(mono(Float32Array.from([1, 0, -1]), Float32Array.from([0, 0, -1])))).toEqual([0.5, 0, -1]);
    expect(Array.from(sum([Float32Array.from([1, 2, 3]), Float32Array.from([10, 20])], 3))).toEqual([11, 22, 3]);
  });
});

describe('alignment', () => {
  const reference = noise(RATE);

  it('finds where a capture sits in a reference whatever gain was applied', () => {
    const capture = reference.subarray(12_345, 12_345 + 20_000).map((value) => value * 0.105);
    const found = align(capture, reference, 12_000, 1000);
    expect(found.offset).toBe(12_345);
    expect(found.correlation).toBeCloseTo(1, 6);
    expect(correlation(capture, reference, found.offset)).toBeCloseTo(1, 6);
  });

  it('does not match a different signal', () => {
    const other = noise(20_000, 99);
    expect(align(other, reference, 12_000, 1000).correlation).toBeLessThan(0.1);
    expect(Math.abs(correlation(other, reference, 12_345))).toBeLessThan(0.05);
  });

  it('aligns on the loud part of a capture that starts silent, and reports nothing for silence', () => {
    const capture = new Float32Array(20_000);
    capture.set(reference.subarray(30_000, 40_000), 10_000);
    expect(loudestWindow(capture, 8192)).toBeGreaterThanOrEqual(10_000);
    expect(align(capture, reference, 20_100, 500).offset).toBe(20_000);
    expect(align(new Float32Array(20_000), reference, 0, 100).correlation).toBe(0);
    expect(correlation(new Float32Array(100), reference, 0)).toBe(0);
  });
});

describe('gain envelope and ramps', () => {
  const reference = noise(RATE * 2);
  const envelopeOf = (shape: (seconds: number) => number) => gainEnvelope(shaped(reference, shape), reference, 0, BLOCK);

  it('reads a constant gain exactly, however loud the passage', () => {
    const quietPassage = reference.map((value, at) => value * (at < RATE ? 1 : 0.01));
    const envelope = gainEnvelope(quietPassage.map((value) => value * 0.3), quietPassage, 0, BLOCK);
    expect(median(envelope)).toBeCloseTo(0.3, 6);
    expect(Math.min(...envelope)).toBeCloseTo(0.3, 5);
    expect(toDb(median(envelope) / 0.3 * 0.35)).toBeCloseTo(-9.1186, 3);
  });

  it('reads exact zeros as a gain of zero and an unreadable block as NaN', () => {
    const silentReference = new Float32Array(BLOCK * 4);
    const envelope = gainEnvelope(Float32Array.from({ length: BLOCK * 4 }, (_, at) => at < BLOCK ? 0 : 1e-9), silentReference, 0, BLOCK);
    expect(envelope[0]).toBe(0);
    expect(Number.isNaN(envelope[1])).toBe(true);
    expect(median([Number.NaN, 1, Number.NaN, 3])).toBe(2);
    expect(Number.isNaN(median([Number.NaN]))).toBe(true);
    expect(median([5, 1, 3])).toBe(3);
  });

  it('measures a linear ramp of known length, short by the tolerance at each end', () => {
    for (const milliseconds of [200, 500]) {
      const envelope = envelopeOf((t) => t < 0.5 ? 0.3 : t < 0.5 + milliseconds / 1000 ? 0.3 - 0.195 * (t - 0.5) * 1000 / milliseconds : 0.105);
      const found = ramp(envelope, 0.3, 0.105, BLOCK_MS, 0.02);
      expect(found).not.toBeNull();
      // "At a level" means within 2% of the move here, so a linear ramp reads up to 4% short.
      expect((found?.durationMs ?? 0) - milliseconds).toBeLessThanOrEqual(BLOCK_MS);
      expect(milliseconds - (found?.durationMs ?? 0)).toBeLessThanOrEqual(0.04 * milliseconds + 2 * BLOCK_MS);
      expect(found?.reversals).toBe(0);
      expect(found?.largestStep).toBeLessThan(0.1);
    }
  });

  it('measures the staircase the app actually writes: eight 25 ms steps, the first one step late', () => {
    const stepped = (t: number) => t < 0.5 ? 0.3 : 0.3 - 0.195 * Math.min(8, Math.floor((t - 0.5) / 0.025)) / 8;
    const found = ramp(envelopeOf(stepped), 0.3, 0.105, BLOCK_MS);
    // Nothing moves for the first 25 ms and the last write lands at 200 ms: 175 ms of movement.
    expect(found?.durationMs).toBeGreaterThanOrEqual(175);
    expect(found?.durationMs).toBeLessThanOrEqual(185);
    expect(found?.largestStep).toBeCloseTo(1 / 8, 2);
  });

  it('reads a step as a step, not as a ramp', () => {
    const found = ramp(envelopeOf((t) => t < 0.5 ? 0.3 : 0.105), 0.3, 0.105, BLOCK_MS);
    expect(found?.durationMs).toBeLessThanOrEqual(BLOCK_MS);
    expect(found?.largestStep).toBeCloseTo(1, 2);
  });

  it('measures a fade-in from silence and a fade-out to it', () => {
    const fadeIn = ramp(envelopeOf((t) => Math.min(0.3, Math.max(0, (t - 0.5) / 0.5 * 0.3))), 0, 0.3, BLOCK_MS, 0.02);
    expect(Math.abs((fadeIn?.durationMs ?? 0) - 490)).toBeLessThanOrEqual(3 * BLOCK_MS);
    const fadeOut = ramp(envelopeOf((t) => Math.min(0.3, Math.max(0, (1 - t) / 0.5 * 0.3))), 0.3, 0, BLOCK_MS, 0.02);
    expect(Math.abs((fadeOut?.durationMs ?? 0) - 490)).toBeLessThanOrEqual(3 * BLOCK_MS);
  });

  it('counts a move that goes the wrong way, and finds none where the level never arrives', () => {
    const bounced = (t: number) => t < 0.5 ? 0.3 : t < 0.6 ? 0.2 : t < 0.7 ? 0.28 : 0.105;
    expect(ramp(envelopeOf(bounced), 0.3, 0.105, BLOCK_MS)?.reversals).toBe(1);
    expect(ramp(envelopeOf(() => 0.3), 0.3, 0.105, BLOCK_MS)).toBeNull();
    expect(ramp(envelopeOf(() => 0.105), 0.3, 0.105, BLOCK_MS)).toBeNull();
  });
});
