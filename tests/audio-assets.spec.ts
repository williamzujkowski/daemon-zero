/**
 * The committed audio files, measured without a browser: each decodes cleanly, is the format
 * and length its manifest says, does not clip, has no dead air beyond a stated bound, and the
 * numbers the docs quote (loudness, peaks, loop seams, mix headroom) are the numbers measured.
 *
 * Needs ffmpeg and ffprobe on the machine. Where they are missing the whole file is skipped and
 * says so; see docs/TESTING.md, "Audio signal measurement".
 */
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import tracks from '../assets/audio/music/tracks.json';
import manifest from '../assets/audio/voice/MANIFEST.json';
import { DUCK_RATIO } from '../src/app/musicController';
import { decode, hasFfmpeg, probe } from './audio/decode';
import { mono, peak, rms, sine, toDb, truePeak } from './audio/dsp';
import { quietEdges, seam, spectralDistance, bandLevels } from './audio/seam';

const available = hasFfmpeg();
if (!available) console.warn('[audio-assets] ffmpeg/ffprobe not found: the committed audio files were NOT measured in this run.');

interface Measured { file: string; rate: number; channels: number; seconds: number; frames: number; warnings: string;
  samplePeak: number; truePeak: number; rmsDb: number; lufs: number; mono: Float32Array }
const cache = new Map<string, Measured>();
function measure(file: string): Measured {
  const known = cache.get(file);
  if (known) return known;
  const format = probe(file); const audio = decode(file, format);
  const mixed = audio.channels.length === 2 ? mono(audio.channels[0] ?? new Float32Array(0), audio.channels[1] ?? new Float32Array(0)) : audio.channels[0] ?? new Float32Array(0);
  const result = { file, rate: format.sampleRate, channels: format.channels, seconds: format.seconds, frames: mixed.length, warnings: audio.warnings,
    samplePeak: Math.max(...audio.channels.map((channel) => peak(channel))), truePeak: Math.max(...audio.channels.map((channel) => truePeak(channel))),
    rmsDb: toDb(rms(mixed)), lufs: audio.lufs, mono: mixed };
  cache.set(file, result);
  return result;
}

const scores = tracks.map((track) => track.path);
const vibration = manifest.clips.map((clip) => 'assets/audio/voice/vibration/' + clip.id + '.mp3');
const clean = manifest.clips.map((clip) => 'assets/audio/voice/clean/' + clip.id + '.mp3');
const range = (values: number[]) => [Math.min(...values), Math.max(...values)] as const;

describe.skipIf(!available)('committed audio files', () => {
  it('every file decodes without a decoder warning and is the documented format', { timeout: 60_000 }, () => {
    for (const track of tracks) {
      const file = measure(track.path);
      expect(file.warnings, track.path).toBe('');
      expect([file.rate, file.channels], track.path + ' is stereo 48 kHz (assets/audio/README.md)').toEqual([48_000, 2]);
      expect(file.seconds, track.path + ' duration in tracks.json').toBeCloseTo(track.duration, 2);
      expect(file.frames / file.rate, track.path + ' decodes to that length').toBeCloseTo(track.duration, 2);
    }
    // Every committed clip is in the manifest, so none goes unmeasured.
    expect(readdirSync('assets/audio/voice/vibration').filter((name) => name.endsWith('.mp3'))).toHaveLength(manifest.clips.length);
    expect(readdirSync('assets/audio/voice/clean').filter((name) => name.endsWith('.mp3'))).toHaveLength(manifest.clips.length);
    for (const clip of manifest.clips) for (const tier of ['vibration', 'clean']) {
      const file = measure('assets/audio/voice/' + tier + '/' + clip.id + '.mp3');
      expect(file.warnings, file.file).toBe('');
      expect([file.rate, file.channels], file.file + ' is mono at the manifest rate').toEqual([clip.sampleRate, 1]);
      expect(file.frames / file.rate, file.file + ' decodes to its container length').toBeCloseTo(file.seconds, 2);
      // A spoken line, not a stub and not a runaway generation.
      expect(file.seconds).toBeGreaterThan(2);
      expect(file.seconds).toBeLessThan(15);
    }
  });

  it('nothing clips: every sample and inter-sample peak is under full scale, at the documented levels', { timeout: 60_000 }, () => {
    for (const file of [...scores, ...vibration, ...clean].map(measure)) {
      expect(file.samplePeak, file.file).toBeLessThan(1);
      expect(file.truePeak, file.file + ' true peak').toBeLessThan(1);
    }
    // docs/VOICE-CLIPS.md quotes these ranges from ffmpeg's meter; this estimator agrees to 0.15 dB.
    const peaks = (files: string[]) => range(files.map((file) => toDb(measure(file).truePeak)));
    for (const [files, low, high] of [[scores, -4.22, -3.04], [vibration, -1.17, -1.09], [clean, -0.93, -0.73]] as const) {
      const [min, max] = peaks([...files]);
      expect(Math.abs(min - low), 'lowest true peak ' + min.toFixed(2)).toBeLessThan(0.15);
      expect(Math.abs(max - high), 'highest true peak ' + max.toFixed(2)).toBeLessThan(0.15);
    }
  });

  it('integrated loudness is in the ranges the docs quote (EBU R128)', { timeout: 60_000 }, () => {
    // The docs' two-decimal figures come from ffmpeg's loudnorm; this is the same meter read
    // through the ebur128 filter, which prints one decimal and reads a four-second clip up to
    // 0.2 LU apart from loudnorm.
    for (const [files, low, high] of [[scores, -15.77, -14.66], [vibration, -15.50, -14.08], [clean, -15.13, -13.51]] as const) {
      const [min, max] = range(files.map((file) => measure(file).lufs));
      expect(Math.abs(min - low), 'quietest ' + min.toFixed(1)).toBeLessThanOrEqual(0.25);
      expect(Math.abs(max - high), 'loudest ' + max.toFixed(1)).toBeLessThanOrEqual(0.25);
    }
  });

  it('no file starts or ends with digital silence, and near-silence at the ends is bounded', { timeout: 60_000 }, () => {
    const milliseconds = (file: Measured, threshold: number) => { const edges = quietEdges(file.mono, threshold); return [edges.lead / file.rate * 1000, edges.trail / file.rate * 1000] as const; };
    for (const file of [...scores, ...vibration, ...clean].map(measure)) {
      const [lead, trail] = milliseconds(file, 0);
      expect(Math.max(lead, trail), file.file + ' exact zeros at an end').toBeLessThan(5);
    }
    // Below -60 dBFS. A bundled clip holds the duck for as long as it plays, so dead air at its
    // end would keep the score down over nothing; the vibration tier has none (its hum runs
    // to the last sample). The scores fade to their ends, the longest tail being phase 4's.
    for (const file of vibration.map(measure)) expect(Math.max(...milliseconds(file, 1e-3)), file.file).toBeLessThan(10);
    for (const file of scores.map(measure)) expect(Math.max(...milliseconds(file, 1e-3)), file.file).toBeLessThan(100);
    // The clean tier is not bundled. It does carry dead air: up to a quarter second before
    // the voice and half a second after, which matters if it is ever wired to the duck.
    const cleanEdges = clean.map(measure).map((file) => milliseconds(file, 1e-3));
    expect(Math.max(...cleanEdges.map(([lead]) => lead))).toBeLessThan(260);
    expect(Math.max(...cleanEdges.map(([, trail]) => trail))).toBeGreaterThan(350);
    expect(Math.max(...cleanEdges.map(([, trail]) => trail))).toBeLessThan(500);
  });

  // Measured on the committed bytes (sha-pinned in tracks.json); the same table is in
  // docs/VOICE-CLIPS.md. jump: |first - last sample| in dBFS. over: that jump against the usual
  // sample-to-sample change in the last 50 ms. tail/head: RMS of the last and first 50 ms.
  // spectral: band-level difference across the seam, against the usual one between neighbours.
  const SEAMS = [
    { jump: -27.8, over: 38.0, tail: -36.4, head: -69.1, spectral: 30.3, usual: 4.5 },
    { jump: -47.6, over: 34.7, tail: -63.6, head: -58.3, spectral: 13.8, usual: 3.3 },
    { jump: -51.6, over: 17.0, tail: -42.2, head: -49.6, spectral: 27.6, usual: 4.7 },
    { jump: -37.2, over: 21.6, tail: -35.4, head: -67.1, spectral: 31.8, usual: 5.7 },
    { jump: -57.5, over: 33.6, tail: -73.9, head: -52.9, spectral: 12.9, usual: 6.8 },
    { jump: -53.8, over: 15.0, tail: -36.7, head: -53.1, spectral: 34.4, usual: 6.1 },
  ];
  it('the loop seam of each score measures what the docs say it does', { timeout: 60_000 }, () => {
    for (const track of tracks) {
      const file = measure(track.path); const found = seam(file.mono, file.rate); const expected = SEAMS[track.phase];
      const label = 'phase ' + String(track.phase) + ' ' + JSON.stringify(Object.fromEntries(Object.entries(found).map(([key, value]) => [key, Number(value.toFixed(1))])));
      expect(Math.abs(found.jumpDb - (expected?.jump ?? 0)), label).toBeLessThan(0.3);
      expect(Math.abs(found.jumpOverUsualDb - (expected?.over ?? 0)), label).toBeLessThan(0.3);
      expect(Math.abs(found.tailDb - (expected?.tail ?? 0)), label).toBeLessThan(0.3);
      expect(Math.abs(found.headDb - (expected?.head ?? 0)), label).toBeLessThan(0.3);
      expect(Math.abs(found.spectralDb - (expected?.spectral ?? 0)), label).toBeLessThan(0.3);
      expect(Math.abs(found.usualSpectralDb - (expected?.usual ?? 0)), label).toBeLessThan(0.3);
      // No seam is silent-to-silent and none is a full-scale click: the worst is phase 0.
      expect(found.jumpDb, label).toBeLessThan(-25);
    }
  });

  it('speech sits above the ducked score, and the mix has the headroom the docs state', { timeout: 60_000 }, () => {
    const speech = vibration.map(measure); const music = scores.map(measure);
    // Whole-file RMS, at equal music and speech preferences, with the duck applied.
    const ratios = speech.flatMap((clip) => music.map((score) => clip.rmsDb - score.rmsDb - toDb(DUCK_RATIO)));
    const [least, most] = range(ratios);
    expect(least, 'lowest speech-to-music ratio ' + least.toFixed(2)).toBeGreaterThan(8.5);
    expect(most, 'highest speech-to-music ratio ' + most.toFixed(2)).toBeLessThan(12.1);
    const loudestClip = Math.max(...speech.map((clip) => clip.truePeak)); const loudestScore = Math.max(...music.map((score) => score.truePeak));
    // At the default 30% / 30% the two cannot clip even before the duck has come down.
    expect(toDb(0.3 * loudestClip + 0.3 * loudestScore)).toBeLessThan(-6);
    // At 100% / 100% coincident peaks would exceed full scale: by about 1 dB once ducked and
    // about 4 dB in the 200 ms before the duck lands. Whether they coincide depends on the
    // passage; the web build measured -0.8 dBTP on one clip (docs/VOICE-CLIPS.md).
    expect(toDb(loudestClip + DUCK_RATIO * loudestScore)).toBeCloseTo(1.03, 1);
    expect(toDb(loudestClip + loudestScore)).toBeCloseTo(4.0, 1);
  });
});

describe('seam measurement', () => {
  const RATE = 48_000;
  it('reads a loop that closes on itself as no jump, and a cut waveform as a click', () => {
    // 100 Hz for exactly one second: the last sample leads straight into the first.
    const closed = seam(sine(0.5, 100, 1, RATE), RATE);
    // The join is one ordinary sample step: at a zero crossing that is root two times the usual.
    expect(closed.jumpOverUsualDb).toBeLessThan(3.5);
    expect(closed.spectralDb).toBeLessThan(1);
    expect(closed.tailDb).toBeCloseTo(closed.headDb, 1);
    // The same tone stopped at a crest: the loop steps from the peak to zero.
    const cut = seam(sine(0.5, 100, 1.0025, RATE), RATE);
    expect(cut.jumpDb).toBeCloseTo(toDb(0.5), 0);
    expect(cut.jumpOverUsualDb).toBeGreaterThan(30);
  });

  it('reads a change of pitch across the seam as a spectral difference', () => {
    const changed = Float32Array.from([...sine(0.5, 2000, 0.5, RATE), ...sine(0.5, 250, 0.5, RATE)]);
    const found = seam(changed, RATE);
    expect(found.spectralDb).toBeGreaterThan(20);
    expect(found.usualSpectralDb).toBeLessThan(1);
    expect(spectralDistance(bandLevels(changed, 0, 2400, RATE), bandLevels(changed, 2400, 2400, RATE))).toBeLessThan(1);
    expect(bandLevels(sine(1, 1000, 0.05, RATE), 0, 2400, RATE)[4]).toBeCloseTo(0, 0);
  });

  it('counts quiet samples at each end against a threshold', () => {
    const padded = Float32Array.from([0, 0, 0.0005, 0.5, -0.5, 0.0005, 0]);
    expect(quietEdges(padded, 0)).toEqual({ lead: 2, trail: 1 });
    expect(quietEdges(padded, 1e-3)).toEqual({ lead: 3, trail: 2 });
    expect(quietEdges(new Float32Array(4), 0)).toEqual({ lead: 4, trail: 0 });
  });
});
