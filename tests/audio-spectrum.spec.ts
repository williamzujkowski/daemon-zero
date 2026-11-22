/**
 * Calibrates the spectrum measurement behind the voice fidelity ladder (#462) against signals whose
 * answer is known, before anything it says about a committed clip is believed.
 */
import { describe, expect, it } from 'vitest';
import { sine, sum } from './audio/dsp';
import { magnitudeSpectrum, shareAbove } from './audio/spectrum';

const RATE = 24_000;

/** The textbook DFT, O(n^2): the reference the fast transform must agree with. */
function directMagnitudes(samples: Float64Array): number[] {
  const n = samples.length;
  return Array.from({ length: Math.floor(n / 2) + 1 }, (_, k) => {
    let re = 0; let im = 0;
    for (let t = 0; t < n; t++) { re += (samples[t] ?? 0) * Math.cos(2 * Math.PI * k * t / n); im -= (samples[t] ?? 0) * Math.sin(2 * Math.PI * k * t / n); }
    return Math.hypot(re, im);
  });
}

describe('magnitude spectrum', () => {
  it('agrees with the direct DFT at lengths that are not a power of two', () => {
    for (const n of [1, 2, 7, 100, 241, 512, 1000]) {
      const samples = Float64Array.from({ length: n }, (_, t) => Math.sin(t * 0.37) + 0.25 * Math.cos(t * 1.9) + (t % 5) / 10);
      const fast = magnitudeSpectrum(samples); const slow = directMagnitudes(samples);
      expect(fast.length, String(n)).toBe(slow.length);
      for (let k = 0; k < slow.length; k++) expect(fast[k] ?? 0, String(n) + ' bin ' + String(k)).toBeCloseTo(slow[k] ?? 0, 6);
    }
  });

  it('puts a whole-cycle sine in its own bin at half the amplitude times the length', () => {
    const tone = sine(0.5, 1000, 1, RATE);
    const magnitude = magnitudeSpectrum(tone);
    expect(magnitude[1000]).toBeCloseTo(0.5 * RATE / 2, 0);
    expect(magnitude[999] ?? 1).toBeLessThan(1e-3);
  });
});

describe('share above a band edge', () => {
  it('reads two tones of known amplitude as their share, and nothing above the top one', () => {
    const tones = sum([sine(0.6, 1000, 1, RATE), sine(0.2, 5000, 1, RATE)], RATE);
    expect(shareAbove(tones, RATE, 3000)).toBeCloseTo(0.25, 4);
    expect(shareAbove(tones, RATE, 500)).toBeCloseTo(1, 4);
    expect(shareAbove(tones, RATE, 7000)).toBeCloseTo(0, 4);
  });

  it('counts bins strictly above the edge, as numpy does with freqs > edge', () => {
    const tone = sine(0.5, 3000, 1, RATE);
    expect(shareAbove(tone, RATE, 3000)).toBeCloseTo(0, 4);
    expect(shareAbove(tone, RATE, 2999)).toBeCloseTo(1, 4);
    expect(shareAbove(new Float32Array(100), RATE, 1000)).toBe(0);
  });
});
