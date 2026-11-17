/**
 * The loop seam of each score, as rendered: where the file's last samples and its first land in
 * the output, what sits between them, and how large the discontinuity is. Player looping was
 * never shown to be inaudible, and a seam is where a click hides; this reports the numbers.
 *
 * Clock: real browser timers (`realTimers`).
 */
import tracks from '../../assets/audio/music/tracks.json';
import { align, correlation, mono, rms, toDb } from '../audio/dsp';
import { expect, test } from './helpers';
import { isScore as music, PHASE_FIXTURES, report, startScore } from './signalMeasure';
import { assetPath, captured, reference, SAMPLE_RATE, serveByteRanges, signalFrame } from './signalTap';

interface Seekable { __signalTap: { taps: { element: { currentTime: number; duration: number } | null }[] } }

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
    element.currentTime = element.duration - 0.8;
    await new Promise((resolve) => { setTimeout(resolve, 100); });
    return element.duration - element.currentTime;
  });
  // A seek lands on a frame boundary near the target, and 100 ms then play.
  expect(landed, 'the seek reached the tail instead of snapping to the start').toBeGreaterThan(0.2);
  expect(landed).toBeLessThan(2);
  await page.waitForTimeout(2200);
  const score = (await captured(page, from)).elements.filter(music).at(-1);
  if (!score) throw new Error('No score was captured.');
  const signal = mono(score.left, score.right);
  const asset = assetPath(score.source);
  const head = await reference(page, asset, 0, 0.5);
  const tail = await reference(page, asset, track.duration - 0.5, 0.5);
  expect(tail.length, 'the decoded file is as long as tracks.json says').toBe(SAMPLE_RATE / 2);
  // Where the file's first sample landed in the capture, and where its last one did.
  const start = align(head, signal, signal.length / 2 - head.length / 2, signal.length / 2, 4096);
  const restart = start.offset;
  const endOffset = align(tail, signal, restart - tail.length, SAMPLE_RATE / 2, 4096);
  const lastSample = endOffset.offset + tail.length;
  report(info, name + ': correlation of the restart with the file head', start.correlation, '(1 = identical)');
  report(info, name + ': correlation before the seam with the file tail', endOffset.correlation, '(1 = identical)');
  expect(start.correlation, 'the score restarted from its first sample').toBeGreaterThan(0.999);
  expect(endOffset.correlation, 'after playing its last').toBeGreaterThan(0.999);
  // The element does not end exactly where a full decode of the file does: it may stop a few
  // milliseconds short or play a little decoder padding. Positive is extra, negative is cut.
  const trim = restart - lastSample;
  report(info, name + ': samples rendered past the decoded end before restarting', trim / SAMPLE_RATE * 1000, 'ms');
  expect(Math.abs(trim), 'the loop ends within an MP3 frame or so of the file end').toBeLessThanOrEqual(SAMPLE_RATE * 0.04);
  let silent = 0;
  while (signal[restart - 1 - silent] === 0) silent += 1;
  report(info, name + ': exact silence inserted at the seam', silent / SAMPLE_RATE * 1000, 'ms');
  // The largest sample-to-sample jump in the 25 ms up to the restart, against the usual one in
  // the 50 ms before that: how much of a discontinuity the seam is, at this volume.
  let jump = 0;
  for (let at = restart - 1200; at <= restart; at++) jump = Math.max(jump, Math.abs((signal[at] ?? 0) - (signal[at - 1] ?? 0)));
  const usual = rms(Float32Array.from({ length: 2400 }, (_, at) => (signal[restart - 3600 + at] ?? 0) - (signal[restart - 3601 + at] ?? 0)));
  report(info, name + ': largest sample jump at the seam, at 30% volume', toDb(jump), 'dBFS');
  report(info, name + ': seam jump over the usual sample-to-sample change before it', toDb(jump / usual), 'dB');
  report(info, name + ': level in the 50 ms before the seam', toDb(rms(signal, restart - 2400, restart)), 'dBFS RMS');
  report(info, name + ': level in the 50 ms after the seam', toDb(rms(signal, restart, restart + 2400)), 'dBFS RMS');
  expect(jump, 'the seam is not a full-scale click').toBeLessThan(0.1);
  expect(correlation(signal, head, -restart, restart, restart + head.length - 4096), 'and plays on').toBeGreaterThan(0.999);
});
