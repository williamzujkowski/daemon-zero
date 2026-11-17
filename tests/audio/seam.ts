/**
 * What happens where a looped file's last sample meets its first: the size of the sample jump,
 * the level either side, and how different the spectrum is. A player that loops a file plays
 * exactly this join, so a click or a lurch there is a property of the file that can be measured
 * without playing it.
 */
import { median, rms, toDb, type Samples } from './dsp';

/** Centre frequencies of the bands compared across the seam, an octave apart. */
const BANDS_HZ = [62.5, 125, 250, 500, 1000, 2000, 4000, 8000];
const WINDOW_SECONDS = 0.05;
/** Below this a band is treated as empty, so two silent bands do not read as a difference. */
const FLOOR_DB = -100;

/** The level of each band in a Hann-windowed stretch, in dB, by a single-bin transform. */
export function bandLevels(samples: Samples, from: number, length: number, rate: number): number[] {
  return BANDS_HZ.map((hz) => {
    let real = 0; let imaginary = 0;
    for (let at = 0; at < length; at++) {
      const weighted = (samples[from + at] ?? 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * at / length));
      real += weighted * Math.cos(2 * Math.PI * hz * at / rate);
      imaginary += weighted * Math.sin(2 * Math.PI * hz * at / rate);
    }
    // A full-scale sine at the band centre reads 0 dB: its windowed sum is length / 4.
    return Math.max(FLOOR_DB, toDb(Math.hypot(real, imaginary) / (length / 4)));
  });
}

/** Root-mean-square difference between two sets of band levels, in dB. */
export function spectralDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((total, level, band) => total + (level - (b[band] ?? FLOOR_DB)) ** 2, 0) / a.length);
}

export interface Seam {
  /** |first sample - last sample|, in dBFS: the step a loop inserts. */
  jumpDb: number;
  /** That step over the usual sample-to-sample change in the last 50 ms: 0 dB is unremarkable. */
  jumpOverUsualDb: number;
  /** RMS of the last and the first 50 ms. */
  tailDb: number; headDb: number;
  /** Band-level difference across the seam, and the usual one between neighbouring 50 ms windows near the end. */
  spectralDb: number; usualSpectralDb: number;
}

export function seam(samples: Samples, rate: number): Seam {
  const window = Math.round(WINDOW_SECONDS * rate);
  const end = samples.length;
  const jump = Math.abs((samples[0] ?? 0) - (samples[end - 1] ?? 0));
  const changes = new Float64Array(window - 1);
  for (let at = 0; at < changes.length; at++) changes[at] = (samples[end - window + at + 1] ?? 0) - (samples[end - window + at] ?? 0);
  const neighbours: number[] = [];
  for (let back = 2; back <= 20; back++) {
    neighbours.push(spectralDistance(bandLevels(samples, end - back * window, window, rate), bandLevels(samples, end - (back - 1) * window, window, rate)));
  }
  return {
    jumpDb: toDb(jump), jumpOverUsualDb: toDb(jump / rms(changes)),
    tailDb: toDb(rms(samples, end - window)), headDb: toDb(rms(samples, 0, window)),
    spectralDb: spectralDistance(bandLevels(samples, end - window, window, rate), bandLevels(samples, 0, window, rate)),
    usualSpectralDb: median(neighbours),
  };
}

/** How many samples at each end are quieter than `threshold` (0 counts exact zeros only). */
export function quietEdges(samples: Samples, threshold: number): { lead: number; trail: number } {
  let lead = 0; let trail = 0;
  while (lead < samples.length && Math.abs(samples[lead] ?? 0) <= threshold) lead++;
  while (trail < samples.length - lead && Math.abs(samples[samples.length - 1 - trail] ?? 0) <= threshold) trail++;
  return { lead, trail };
}
