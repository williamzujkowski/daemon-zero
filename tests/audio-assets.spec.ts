/**
 * The committed audio files, measured without a browser: each decodes cleanly, is the format
 * and length its manifest says, does not clip, has no dead air beyond a stated bound, and the
 * numbers the docs quote (loudness, peaks, loop seams, mix headroom) are the numbers measured.
 *
 * Needs ffmpeg and ffprobe on the machine. Where they are missing the file checks are skipped
 * and say so, except under CI (`CI` set), where a missing tool fails the run: the workflow
 * installs ffmpeg (pinned in mise.toml), so a skip there would be a gate that quietly stopped
 * running. See docs/TESTING.md, "Audio signal measurement".
 */
import { voiceTierFolders } from './voice-files';
import { describe, expect, it } from 'vitest';
import tracks from '../assets/audio/music/tracks.json';
import manifest from '../assets/audio/voice/MANIFEST.json';
import { DUCK_RATIO } from '../src/app/musicController';
import { OUTPUT_SCALE, SCORE_PEAK_CEILING, SPEECH_PEAK_CEILING } from '../src/app/outputLevel';
import { decode, hasFfmpeg, probe } from './audio/decode';
import { mono, peak, rms, sine, toDb, truePeak } from './audio/dsp';
import { quietEdges, seam, spectralDistance, bandLevels } from './audio/seam';
import { sharesAbove } from './audio/spectrum';

const available = hasFfmpeg();
const onCi = Boolean(process.env.CI);
if (!available) console.warn('[audio-assets] ffmpeg/ffprobe not found: the committed audio files were NOT measured in this run.');

it('has ffmpeg and ffprobe wherever CI is set, so the file checks below cannot be skipped there', () => {
  expect(available || !onCi, 'CI is set but ffmpeg/ffprobe are missing: run `mise install` (mise.toml pins them)').toBe(true);
});

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
/** The tiers a clip has, from its manifest digests: the host's lines have two, every other line one (#462). */
const tiersOf = (clip: (typeof manifest.clips)[number]) => Object.keys(clip.sha256);
const tier = (name: string) => manifest.clips.filter((clip) => tiersOf(clip).includes(name)).map((clip) => 'assets/audio/voice/' + name + '/' + clip.id + '.mp3');
const vibration = tier('vibration');
const clean = tier('clean');
/** The fidelity ladder's new rungs, all bundled (docs/VOICE-CLIPS.md, "The fidelity ladder"). */
const LADDER = ['phone', 'stream', 'broadcast', 'direct', 'peer'] as const;
const ladder = LADDER.flatMap((name) => tier(name));
/** Every clip the app bundles: each line's one non-clean tier. */
const bundled = [...vibration, ...ladder];
const voices = [...bundled, ...clean];
const range = (values: number[]) => [Math.min(...values), Math.max(...values)] as const;

describe.skipIf(!available && !onCi)('committed audio files', () => {
  it('every file decodes without a decoder warning and is the documented format', { timeout: 60_000 }, () => {
    for (const track of tracks) {
      const file = measure(track.path);
      expect(file.warnings, track.path).toBe('');
      expect([file.rate, file.channels], track.path + ' is stereo 48 kHz (assets/audio/README.md)').toEqual([48_000, 2]);
      expect(file.seconds, track.path + ' duration in tracks.json').toBeCloseTo(track.duration, 2);
      expect(file.frames / file.rate, track.path + ' decodes to that length').toBeCloseTo(track.duration, 2);
    }
    // Every committed clip is in the manifest, so none goes unmeasured.
    expect([...voiceTierFolders.keys()].sort()).toEqual(['vibration', 'clean', ...LADDER].sort());
    for (const [name, files] of voiceTierFolders) expect(files.filter((file) => file.endsWith('.mp3')), name).toHaveLength(tier(name).length);
    for (const clip of manifest.clips) for (const name of tiersOf(clip)) {
      const file = measure('assets/audio/voice/' + name + '/' + clip.id + '.mp3');
      expect(file.warnings, file.file).toBe('');
      expect([file.rate, file.channels], file.file + ' is mono at the manifest rate').toEqual([clip.sampleRate, 1]);
      expect(file.frames / file.rate, file.file + ' decodes to its container length').toBeCloseTo(file.seconds, 2);
      // A spoken line, not a stub and not a runaway generation.
      expect(file.seconds).toBeGreaterThan(2);
      expect(file.seconds).toBeLessThan(15);
    }
  });

  it('nothing clips: every sample and inter-sample peak is under full scale, at the documented levels', { timeout: 60_000 }, () => {
    for (const file of [...scores, ...voices].map(measure)) {
      expect(file.samplePeak, file.file).toBeLessThan(1);
      expect(file.truePeak, file.file + ' true peak').toBeLessThan(1);
    }
    // The ceilings the output scale is computed from (src/app/outputLevel.ts). A louder file
    // fails here rather than silently taking the 100%/100% mix over full scale.
    for (const file of scores.map(measure)) expect(file.truePeak, file.file + ' under SCORE_PEAK_CEILING').toBeLessThanOrEqual(SCORE_PEAK_CEILING);
    for (const file of voices.map(measure)) expect(file.truePeak, file.file + ' under SPEECH_PEAK_CEILING').toBeLessThanOrEqual(SPEECH_PEAK_CEILING);
    // docs/VOICE-CLIPS.md quotes these ranges; scores, vibration and clean from ffmpeg's meter, the
    // ladder's from this estimator, which agrees with ffmpeg's to 0.15 dB.
    const peaks = (files: string[]) => range(files.map((file) => toDb(measure(file).truePeak)));
    for (const [files, low, high] of [[scores, -4.22, -3.04], [vibration, -1.17, -1.09], [clean, -0.93, -0.73],
      [tier('phone'), -2.16, -1.70], [tier('stream'), -2.88, -2.18], [tier('broadcast'), -3.08, -1.14],
      [tier('direct'), -3.07, -1.92], [tier('peer'), -2.33, -1.99]] as const) {
      const [min, max] = peaks([...files]);
      expect(Math.abs(min - low), 'lowest true peak ' + min.toFixed(2)).toBeLessThan(0.15);
      expect(Math.abs(max - high), 'highest true peak ' + max.toFixed(2)).toBeLessThan(0.15);
    }
  });

  it('integrated loudness is in the ranges the docs quote (EBU R128)', { timeout: 60_000 }, () => {
    // The docs' two-decimal figures come from ffmpeg's loudnorm; this is the same meter read
    // through the ebur128 filter, which prints one decimal and reads a four-second clip up to
    // 0.2 LU apart from loudnorm.
    const [quietest, loudest] = range(scores.map((file) => measure(file).lufs));
    expect(Math.abs(quietest - -15.77), 'quietest score ' + quietest.toFixed(1)).toBeLessThanOrEqual(0.25);
    expect(Math.abs(loudest - -14.66), 'loudest score ' + loudest.toFixed(1)).toBeLessThanOrEqual(0.25);
    // The clips' ranges are quoted from this same meter, so they must match to its one decimal. The
    // loudnorm figures the docs used to quote drifted up to 0.29 LU from it on a four-second clip
    // (ambient_13: loudnorm -14.09, ebur128 -13.8), which a 0.25 tolerance could not hold.
    for (const [files, low, high] of [[vibration, -15.4, -13.8], [clean, -15.0, -13.3], [tier('phone'), -15.4, -15.1],
      [tier('stream'), -15.5, -15.3], [tier('broadcast'), -15.2, -14.6], [tier('direct'), -15.5, -15.2], [tier('peer'), -15.5, -15.3]] as const) {
      const [min, max] = range(files.map((file) => measure(file).lufs));
      expect(Math.abs(min - low), String(files[0]) + ' quietest ' + min.toFixed(1)).toBeLessThan(0.051);
      expect(Math.abs(max - high), String(files[0]) + ' loudest ' + max.toFixed(1)).toBeLessThan(0.051);
    }
    // Every bundled rung of the ladder is levelled to the vibration tier (scripts/voice/chains.py,
    // TARGET_RMS_DB) and lands within 0.15 LU of its range: a phase change moves the sound, not the level.
    for (const file of ladder.map(measure)) expect(file.lufs, file.file).toBeGreaterThanOrEqual(-15.55);
    for (const file of ladder.map(measure)) expect(file.lufs, file.file).toBeLessThanOrEqual(-13.8);
  });

  it('no file starts or ends with digital silence, and near-silence at the ends is bounded', { timeout: 60_000 }, () => {
    const milliseconds = (file: Measured, threshold: number) => { const edges = quietEdges(file.mono, threshold); return [edges.lead / file.rate * 1000, edges.trail / file.rate * 1000] as const; };
    for (const file of [...scores, ...voices].map(measure)) {
      const [lead, trail] = milliseconds(file, 0);
      expect(Math.max(lead, trail), file.file + ' exact zeros at an end').toBeLessThan(5);
    }
    // Below -60 dBFS. A bundled clip holds the duck for as long as it plays, so dead air at its
    // end would keep the score down over nothing; the vibration tier has none (its hum runs
    // to the last sample). The scores fade to their ends, the longest tail being phase 4's.
    for (const file of vibration.map(measure)) expect(Math.max(...milliseconds(file, 1e-3)), file.file).toBeLessThan(10);
    for (const file of scores.map(measure)) expect(Math.max(...milliseconds(file, 1e-3)), file.file).toBeLessThan(100);
    // The ladder's rungs are trimmed to the voice with a 40 ms lead and 80 ms tail pad (chains.py,
    // `trim`), so their near-silence is that pad and nothing more: measured up to 45 ms and 76 ms.
    for (const file of ladder.map(measure)) expect(Math.max(...milliseconds(file, 1e-3)), file.file).toBeLessThan(90);
    // The clean tier is not bundled. It does carry dead air: up to 0.27 s before the voice
    // (ambient_13) and half a second after, which matters if it is ever wired to the duck.
    const cleanEdges = clean.map(measure).map((file) => milliseconds(file, 1e-3));
    expect(Math.max(...cleanEdges.map(([lead]) => lead))).toBeLessThan(280);
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
    // Every bundled clip, every rung of the ladder included (#462).
    const speech = bundled.map(measure); const music = scores.map(measure);
    // Whole-file RMS, at equal music and speech preferences, with the duck applied.
    const ratios = speech.flatMap((clip) => music.map((score) => clip.rmsDb - score.rmsDb - toDb(DUCK_RATIO)));
    const [least, most] = range(ratios);
    expect(least, 'lowest speech-to-music ratio ' + least.toFixed(2)).toBeGreaterThan(8.5);
    // 12.0 until #462: ambient_13's vibration take (the host chain, unchanged) is the loudest clip by RMS, at 12.36.
    expect(most, 'highest speech-to-music ratio ' + most.toFixed(2)).toBeLessThan(12.4);
    const loudestClip = Math.max(...speech.map((clip) => clip.truePeak)); const loudestScore = Math.max(...music.map((score) => score.truePeak));
    // Unscaled, coincident peaks at 100% / 100% would exceed full scale by about 1 dB once
    // ducked and about 4 dB in the 200 ms before the duck lands; that is why OUTPUT_SCALE exists.
    expect(toDb(loudestClip + DUCK_RATIO * loudestScore)).toBeCloseTo(1.03, 1);
    expect(toDb(loudestClip + loudestScore)).toBeCloseTo(4.0, 1);
    // Scaled, as the players are handed them: under full scale at 100% / 100% before the duck,
    // and well under at the 30% defaults (docs/VOICE-CLIPS.md, "Headroom").
    const worst = toDb(OUTPUT_SCALE * (loudestClip + loudestScore));
    expect(worst, 'both at 100%, before the duck lands ' + worst.toFixed(2)).toBeLessThan(0);
    expect(worst).toBeCloseTo(-0.44, 1);
    expect(toDb(OUTPUT_SCALE * (loudestClip + DUCK_RATIO * loudestScore))).toBeCloseTo(-3.41, 1);
    expect(toDb(0.3 * OUTPUT_SCALE * (loudestClip + loudestScore))).toBeLessThan(-10);
  });

  // The fidelity ladder (#462), as PROVENANCE.md records it: the share of each file's magnitude
  // spectrum above a band edge, computed as scripts/voice/generate-clips.py --measure does. Per
  // tier, the [min, max] percentages above 3 kHz, 3.4 kHz and 7 kHz.
  const LADDER_SHARES: Record<string, [number, number][]> = {
    vibration: [[1.16, 2.82], [1.04, 2.56], [0.45, 1.11]],
    phone: [[2.13, 3.72], [0.45, 1.31], [0.10, 0.23]],
    stream: [[10.03, 12.88], [8.09, 10.95], [0.02, 0.08]],
    broadcast: [[35.80, 48.38], [33.43, 46.48], [20.78, 30.53]],
    direct: [[18.62, 23.46], [16.96, 21.73], [9.55, 13.03]],
    peer: [[15.40, 22.68], [13.85, 21.29], [6.61, 12.59]],
  };
  it('each rung of the ladder is band-limited where its chain says, and fidelity rises with the phase', { timeout: 300_000 }, () => {
    const shares = new Map(Object.keys(LADDER_SHARES).map((name) => [name, tier(name).map((file) => {
      const found = measure(file);
      return sharesAbove(found.mono, found.rate, [3000, 3400, 7000]).map((share) => 100 * share);
    })]));
    for (const [name, expected] of Object.entries(LADDER_SHARES)) {
      expected.forEach(([low, high], edge) => {
        const [min, max] = range((shares.get(name) ?? []).map((row) => row[edge] ?? Number.NaN));
        expect(Math.abs(min - low), name + ' edge ' + String(edge) + ' min ' + min.toFixed(2)).toBeLessThan(0.05);
        expect(Math.abs(max - high), name + ' edge ' + String(edge) + ' max ' + max.toFixed(2)).toBeLessThan(0.05);
      });
    }
    // Each chain keeps under 1.5% of its spectrum past its own band edge (vibration 3 kHz, phone
    // 3.4 kHz, stream 7 kHz; broadcast's 15 kHz is past the model's 12 kHz Nyquist), and the narrow
    // rungs carry almost nothing above 7 kHz where the broadcast and clean rungs carry a tenth or more.
    const worst = (name: string, edge: number) => Math.max(...(shares.get(name) ?? []).map((row) => row[edge] ?? 1));
    const least = (name: string, edge: number) => Math.min(...(shares.get(name) ?? []).map((row) => row[edge] ?? 0));
    expect(worst('phone', 1)).toBeLessThan(1.5);
    expect(worst('stream', 2)).toBeLessThan(0.1);
    for (const narrow of ['vibration', 'phone', 'stream']) for (const wide of ['broadcast', 'direct', 'peer']) {
      expect(worst(narrow, 2), narrow + ' below ' + wide + ' above 7 kHz').toBeLessThan(least(wide, 2));
    }
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
