/**
 * The loop seam of each score, as rendered: where the file's last samples and its first land in
 * the output, what sits between them, and how large the discontinuity is, both at the wrap and
 * across the player's dip around it (`loopSeam.ts`). A seam is where a click hides.
 *
 * Clock: real browser timers (`realTimers`).
 */
import tracks from '../../assets/audio/music/tracks.json';
import { align, correlation, mono, rms, toDb, type Samples } from '../audio/dsp';
import { expect, test } from './helpers';
import { isScore as music, PHASE_FIXTURES, LEVEL, report, startScore } from './signalMeasure';
import { assetPath, captured, reference, SAMPLE_RATE, serveByteRanges, signalFrame } from './signalTap';

interface Seekable { __signalTap: { taps: { element: { currentTime: number; duration: number } | null }[] } }

const ms = (value: number) => Math.round(value / 1000 * SAMPLE_RATE);
/** Kept out of the alignment on both sides: the stretch where a dip around the wrap reshapes the
 *  level, so the waveform match is made on samples at the steady level. */
const RESHAPED = ms(200);
/** The wide window a seam is judged over: the dip's fall before the wrap and its rise after. */
const BEFORE = ms(200); const AFTER = ms(150);
/** Where the steady level is read, well before anything near the end could have moved it. */
const STEADY = ms(400);

/** The least-squares gain that turns `ref[from - offset ..]` into `signal[from ..]`, over `length`. */
function gainOver(signal: Samples, ref: Samples, offset: number, from: number, length: number): number {
  let dot = 0; let energy = 0;
  for (let at = from; at < from + length; at++) { const value = ref[at - offset] ?? 0; dot += (signal[at] ?? 0) * value; energy += value * value; }
  return energy > 0 ? dot / energy : Number.NaN;
}

/** The largest sample-to-sample change in [from, to), and the RMS of that change over [usualFrom, usualFrom + usual). */
function jumps(signal: Samples, from: number, to: number, usualFrom: number, usual: number): { jump: number; usual: number } {
  let jump = 0;
  for (let at = from; at < to; at++) jump = Math.max(jump, Math.abs((signal[at] ?? 0) - (signal[at - 1] ?? 0)));
  return { jump, usual: rms(Float32Array.from({ length: usual }, (_, at) => (signal[usualFrom + at] ?? 0) - (signal[usualFrom + at - 1] ?? 0))) };
}

for (const track of tracks) test('phase ' + String(track.phase) + ' loop seam, as rendered', async ({ page }, info) => {
  const name = 'phase ' + String(track.phase) + ' loop';
  // The suite's static server ignores Range, which leaves media unseekable: a seek to the tail
  // lands on 0 and "loops" without ever playing the end. Serve ranges, then prove the seek held.
  await serveByteRanges(page, '**/audio/music/**/*.mp3');
  await startScore(page, PHASE_FIXTURES[track.phase] ?? '');
  const from = await signalFrame(page);
  const landed = await page.evaluate(async () => {
    const element = (globalThis as unknown as Seekable).__signalTap.taps.at(-1)?.element;
    if (!element) return -1;
    element.currentTime = element.duration - 3;
    await new Promise((resolve) => { setTimeout(resolve, 100); });
    return element.duration - element.currentTime;
  });
  // A seek lands on a frame boundary near the target, and 100 ms then play.
  expect(landed, 'the seek reached the tail instead of snapping to the start').toBeGreaterThan(2);
  expect(landed).toBeLessThan(4);
  await page.waitForTimeout(4400);
  const score = (await captured(page, from)).elements.filter(music).at(-1);
  if (!score) throw new Error('No score was captured.');
  const signal = mono(score.left, score.right);
  const asset = assetPath(score.source);
  const head = await reference(page, asset, 0, 0.6);
  const tail = await reference(page, asset, track.duration - 0.8, 0.8);
  expect(tail.length, 'the decoded file is as long as tracks.json says').toBe(ms(800));
  // Where the file's first sample landed in the capture, and where its last one did, each found
  // from the part of the file that is clear of the dip.
  const start = align(head.subarray(RESHAPED), signal, signal.length / 2 - head.length / 2, signal.length / 2, 4096);
  const restart = start.offset - RESHAPED;
  const endOffset = align(tail.subarray(0, tail.length - RESHAPED), signal, restart - tail.length, ms(500), 4096);
  const lastSample = endOffset.offset + tail.length;
  report(info, name + ': correlation of the restart with the file head', start.correlation, '(1 = identical)');
  report(info, name + ': correlation before the seam with the file tail', endOffset.correlation, '(1 = identical)');
  expect(start.correlation, 'the score restarted from its first sample').toBeGreaterThan(0.999);
  expect(endOffset.correlation, 'after playing its last').toBeGreaterThan(0.999);
  // The element does not end exactly where a full decode of the file does: it may stop a few
  // milliseconds short or play a little decoder padding. Positive is extra, negative is cut.
  const trim = restart - lastSample;
  report(info, name + ': samples rendered past the decoded end before restarting', trim / SAMPLE_RATE * 1000, 'ms');
  expect(Math.abs(trim), 'the loop ends within an MP3 frame or so of the file end').toBeLessThanOrEqual(ms(40));
  let silent = 0;
  while (signal[restart - 1 - silent] === 0) silent += 1;
  report(info, name + ': exact silence inserted at the seam', silent / SAMPLE_RATE * 1000, 'ms');

  // The level is the preference until the dip, which starts no earlier than a fall and a guard
  // and a couple of late ticks before the end.
  const steady = gainOver(signal, tail, endOffset.offset, lastSample - STEADY - ms(50), ms(50));
  expect(toDb(steady), 'the steady level is the preference').toBeCloseTo(toDb(LEVEL), 1);

  // At the wrap: the largest step in the 25 ms up to the restart, against the usual one in the
  // 50 ms before that (the measure the first report used, kept so the numbers compare).
  const narrow = jumps(signal, restart - ms(25), restart + 1, restart - ms(75), ms(50));
  report(info, name + ': largest sample jump at the seam', toDb(narrow.jump), 'dBFS');
  report(info, name + ': seam jump over the usual sample-to-sample change before it', toDb(narrow.jump / narrow.usual), 'dB');
  // Across the dip's fall and the wrap, against the usual change before the dip; and over the
  // rise into the file's first notes, which is music as much as seam.
  const fall = jumps(signal, restart - BEFORE, restart + 1, restart - BEFORE - ms(100), ms(100));
  const rise = jumps(signal, restart + 1, restart + AFTER, restart - BEFORE - ms(100), ms(100));
  report(info, name + ': largest sample jump in the 200 ms up to the restart', toDb(fall.jump), 'dBFS');
  report(info, name + ': that jump over the usual change before it', toDb(fall.jump / fall.usual), 'dB');
  report(info, name + ': largest sample jump in the 150 ms after the restart', toDb(rise.jump), 'dBFS');
  report(info, name + ': level in the 50 ms before the seam', toDb(rms(signal, restart - ms(50), restart)), 'dBFS RMS');
  report(info, name + ': level in the 50 ms after the seam', toDb(rms(signal, restart, restart + ms(50))), 'dBFS RMS');
  expect(narrow.jump, 'the seam is not a full-scale click').toBeLessThan(0.1);
  expect(correlation(signal, head, -restart, restart + RESHAPED, restart + head.length - 4096), 'and plays on').toBeGreaterThan(0.999);
});
