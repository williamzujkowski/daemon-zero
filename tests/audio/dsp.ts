/**
 * Signal measurements for the audio tests: level, peak, alignment against a reference file, and
 * the gain a player applied over time. Pure functions over sample arrays, so they are unit
 * tested against synthetic signals of known level (tests/audio-dsp.spec.ts) before anything
 * they report about the game's audio is believed.
 */

export type Samples = Float32Array | Float64Array;

/** An amplitude ratio in decibels. Zero is minus infinity, which is what digital silence is. */
export function toDb(ratio: number): number {
  return 20 * Math.log10(ratio);
}

export function rms(samples: Samples, from = 0, to = samples.length): number {
  let sum = 0;
  for (let at = from; at < to; at++) sum += (samples[at] ?? 0) ** 2;
  return to > from ? Math.sqrt(sum / (to - from)) : 0;
}

/** The largest sample magnitude. */
export function peak(samples: Samples, from = 0, to = samples.length): number {
  let max = 0;
  for (let at = from; at < to; at++) max = Math.max(max, Math.abs(samples[at] ?? 0));
  return max;
}

const OVERSAMPLE = 4;
const SINC_HALF_WIDTH = 12;
/** Windowed-sinc coefficients for the three positions between two samples. */
const INTERPOLATORS: Float64Array[] = [1, 2, 3].map((phase) => {
  const taps = new Float64Array(SINC_HALF_WIDTH * 2);
  for (let tap = 0; tap < taps.length; tap++) {
    const x = tap - SINC_HALF_WIDTH + 1 - phase / OVERSAMPLE;
    const window = 0.5 + 0.5 * Math.cos(Math.PI * x / SINC_HALF_WIDTH);
    taps[tap] = (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * window;
  }
  return taps;
});

/**
 * An estimate of the true (inter-sample) peak: the largest magnitude after 4x band-limited
 * interpolation, as BS.1770 describes. An estimate, not a certified meter: it reads within
 * about 0.1 dB of the real peak for content below a quarter of the sample rate.
 */
export function truePeak(samples: Samples, from = 0, to = samples.length): number {
  let max = peak(samples, from, to);
  for (let at = Math.max(from, SINC_HALF_WIDTH); at < Math.min(to, samples.length - SINC_HALF_WIDTH); at++) {
    // Only neighbourhoods that could beat the running peak are worth interpolating.
    if (Math.abs(samples[at] ?? 0) + Math.abs(samples[at + 1] ?? 0) < max) continue;
    for (const taps of INTERPOLATORS) {
      let value = 0;
      for (let tap = 0; tap < taps.length; tap++) value += (taps[tap] ?? 0) * (samples[at + tap - SINC_HALF_WIDTH + 1] ?? 0);
      max = Math.max(max, Math.abs(value));
    }
  }
  return max;
}

/** The average of two channels: what both tests and references are compared in. */
export function mono(left: Samples, right: Samples): Float32Array {
  const out = new Float32Array(left.length);
  for (let at = 0; at < out.length; at++) out[at] = ((left[at] ?? 0) + (right[at] ?? 0)) / 2;
  return out;
}

/** The sum of several captures on one timeline: what a mixer does with them. */
export function sum(parts: Samples[], length: number): Float32Array {
  const out = new Float32Array(length);
  for (const part of parts) for (let at = 0; at < Math.min(length, part.length); at++) out[at] = (out[at] ?? 0) + (part[at] ?? 0);
  return out;
}

/** The start of the `width`-sample stretch with the most energy: the best place to align on. */
export function loudestWindow(samples: Samples, width: number, from = 0, to = samples.length): number {
  let best = from; let bestEnergy = -1; let energy = 0;
  for (let at = from; at < to; at++) {
    energy += (samples[at] ?? 0) ** 2;
    if (at - from >= width) energy -= (samples[at - width] ?? 0) ** 2;
    if (at - from >= width - 1 && energy > bestEnergy) { bestEnergy = energy; best = at - width + 1; }
  }
  return best;
}

export interface Alignment {
  /** `capture[i]` corresponds to `reference[i + offset]`. */
  offset: number;
  /** Normalised correlation at that offset, over the window used: 1 is the same waveform. */
  correlation: number;
}

/**
 * Where a capture sits in a reference, by normalised cross-correlation of the capture's loudest
 * window against every offset within `search` samples of `expected`. Normalising makes the
 * answer independent of the gain the player applied, which is the thing measured afterwards.
 */
export function align(capture: Samples, reference: Samples, expected: number, search: number, width = 8192): Alignment {
  const at = loudestWindow(capture, Math.min(width, capture.length));
  const size = Math.min(width, capture.length - at);
  let captureEnergy = 0;
  for (let index = 0; index < size; index++) captureEnergy += (capture[at + index] ?? 0) ** 2;
  let best: Alignment = { offset: expected, correlation: 0 };
  for (let offset = expected - search; offset <= expected + search; offset++) {
    const start = at + offset;
    if (start < 0 || start + size > reference.length) continue;
    let dot = 0; let energy = 0;
    for (let index = 0; index < size; index++) {
      const value = reference[start + index] ?? 0;
      dot += (capture[at + index] ?? 0) * value;
      energy += value * value;
    }
    const correlation = captureEnergy > 0 && energy > 0 ? dot / Math.sqrt(captureEnergy * energy) : 0;
    if (correlation > best.correlation) best = { offset, correlation };
  }
  return best;
}

/** Normalised correlation of a stretch of capture with the reference at a known offset. */
export function correlation(capture: Samples, reference: Samples, offset: number, from = 0, to = capture.length): number {
  let dot = 0; let a = 0; let b = 0;
  for (let at = from; at < to; at++) {
    const x = capture[at] ?? 0; const y = reference[at + offset] ?? 0;
    dot += x * y; a += x * x; b += y * y;
  }
  return a > 0 && b > 0 ? dot / Math.sqrt(a * b) : 0;
}

/**
 * The gain applied to the reference in each `hop`-sample block of the capture, by least
 * squares: the factor that best turns the file's samples into the samples that came out. This
 * is the level envelope with the music's own dynamics divided out, so a duck or a fade reads
 * as a number however loud the passage is. A block of exact zeros is a gain of 0. Other blocks
 * where the reference is too quiet to say (below `floor` RMS) are NaN.
 */
export function gainEnvelope(capture: Samples, reference: Samples, offset: number, hop: number, floor = 1e-5): Float64Array {
  const blocks = Math.floor(capture.length / hop);
  const out = new Float64Array(blocks);
  for (let block = 0; block < blocks; block++) {
    let dot = 0; let energy = 0; let silent = true;
    for (let at = block * hop; at < (block + 1) * hop; at++) {
      const value = reference[at + offset] ?? 0;
      const sample = capture[at] ?? 0;
      if (sample !== 0) silent = false;
      dot += sample * value;
      energy += value * value;
    }
    // Nothing came out: that is a gain of zero whatever the file holds there.
    out[block] = silent ? 0 : energy / hop > floor * floor ? dot / energy : Number.NaN;
  }
  return out;
}

/** The median of the readable values in a stretch of an envelope. */
export function median(values: Samples | number[], from = 0, to = values.length): number {
  const kept = Array.from(values.slice(from, to)).filter((value) => !Number.isNaN(value)).sort((a, b) => a - b);
  const middle = kept.length >> 1;
  return kept.length === 0 ? Number.NaN : kept.length % 2 === 1 ? (kept[middle] ?? Number.NaN) : ((kept[middle - 1] ?? 0) + (kept[middle] ?? 0)) / 2;
}

export interface Ramp {
  /** Block index of the last reading still at the starting level, and of the first at the final level. */
  startBlock: number; endBlock: number;
  /** Time from leaving the starting level to arriving at the final one. */
  durationMs: number;
  /** The largest change between neighbouring readable blocks, as a fraction of the whole move. */
  largestStep: number;
  /** Readings on the way that go the wrong way by more than the tolerance. */
  reversals: number;
}

/**
 * Finds a level move in an envelope between two resting levels. "At" a level means within
 * `tolerance` of it, as a fraction of the move. A step change measures as one block; a
 * staircase measures from its first write to its last; a smooth ramp reads short by the
 * tolerance at each end.
 */
export function ramp(envelope: Samples, from: number, to: number, blockMs: number, tolerance = 0.05): Ramp | null {
  const progress = Array.from(envelope, (value) => (value - from) / (to - from));
  let endBlock = -1;
  for (let block = 0; block < progress.length; block++) {
    const value = progress[block] ?? Number.NaN;
    if (!Number.isNaN(value) && value >= 1 - tolerance) { endBlock = block; break; }
  }
  if (endBlock < 0) return null;
  let startBlock = -1;
  for (let block = endBlock - 1; block >= 0; block--) {
    const value = progress[block] ?? Number.NaN;
    if (!Number.isNaN(value) && value <= tolerance) { startBlock = block; break; }
  }
  if (startBlock < 0) return null;
  let largestStep = 0; let reversals = 0; let last = progress[startBlock] ?? 0;
  for (let block = startBlock + 1; block <= endBlock; block++) {
    const value = progress[block] ?? Number.NaN;
    if (Number.isNaN(value)) continue;
    largestStep = Math.max(largestStep, value - last);
    if (value < last - tolerance) reversals += 1;
    last = value;
  }
  return { startBlock, endBlock, durationMs: (endBlock - startBlock) * blockMs, largestStep, reversals };
}

/** A sine of known amplitude, for calibrating the functions above. */
export function sine(amplitude: number, hz: number, seconds: number, rate: number, phase = 0): Float32Array {
  const out = new Float32Array(Math.round(seconds * rate));
  for (let at = 0; at < out.length; at++) out[at] = amplitude * Math.sin(2 * Math.PI * hz * at / rate + phase);
  return out;
}
