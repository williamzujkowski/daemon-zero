/**
 * The instrument, measured before anything is measured with it.
 *
 * `signalTap.ts` re-routes every media element through Web Audio. That is only a measurement of
 * the app if `element.volume` still shapes the signal in that graph, and if the tap adds no gain
 * of its own. This plays a tone of known level through the same tap, with no app involved, and
 * checks the absolute level, the level at each volume the app uses, and how quickly a single
 * volume write shows in the samples (which is the floor under every ramp duration reported).
 */
import { expect, test, type Page } from '@playwright/test';
import { peak, rms, toDb } from '../audio/dsp';
import { DUCK_RATIO } from '../../src/app/musicController';
import { report } from './signalMeasure';
import { captured, installSignalTap, SAMPLE_RATE, signalFrame, signalTapReady } from './signalTap';

const AMPLITUDE = 0.25;
/** RMS of a sine is its amplitude over root two. */
const TONE_DBFS = toDb(AMPLITUDE / Math.SQRT2);
const SETTLE_MS = 500;
const WINDOW = Math.round(0.25 * SAMPLE_RATE);

interface Tone { volume: number; play(): Promise<void>; pause(): void }
interface ToneBrowser { __tone: Tone; Audio: new (source: string) => Tone;
  Blob: new (parts: ArrayBuffer[], options: { type: string }) => object; URL: { createObjectURL(blob: object): string } }

test.beforeEach(async ({ page }) => {
  await installSignalTap(page);
  await page.route('**/__control.html', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>control</title>' }));
  await page.goto('./__control.html');
  await signalTapReady(page);
  // A 16-bit mono WAV of a 1 kHz sine, built in the page: a file whose level is known exactly.
  await page.evaluate(async ([amplitude, rate]) => {
    const browser = globalThis as unknown as ToneBrowser;
    const count = rate * 6;
    const bytes = new ArrayBuffer(44 + count * 2); const view = new DataView(bytes);
    const text = (at: number, value: string) => { for (let index = 0; index < value.length; index++) view.setUint8(at + index, value.charCodeAt(index)); };
    text(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, count * 2, true);
    for (let at = 0; at < count; at++) view.setInt16(44 + at * 2, Math.round(amplitude * 32767 * Math.sin(2 * Math.PI * 1000 * at / rate)), true);
    browser.__tone = new browser.Audio(browser.URL.createObjectURL(new browser.Blob([bytes], { type: 'audio/wav' })));
    await browser.__tone.play();
  }, [AMPLITUDE, SAMPLE_RATE] as const);
});

async function setVolume(page: Page, volume: number): Promise<void> {
  await page.evaluate((value) => { (globalThis as unknown as ToneBrowser).__tone.volume = value; }, volume);
}

test('the tap adds no gain and element.volume shapes the captured signal', async ({ page }, info) => {
  const levels: Record<string, number> = {};
  for (const volume of [1, 0.5, DUCK_RATIO, 0.3, 0.3 * DUCK_RATIO]) {
    await setVolume(page, volume);
    await page.waitForTimeout(SETTLE_MS);
    const { mix, elements } = await captured(page);
    const element = elements[0];
    if (!element) throw new Error('The tone element was not tapped.');
    const level = toDb(rms(element.left, element.left.length - WINDOW));
    levels[String(volume)] = level;
    report(info, 'control tone at volume ' + String(volume), level, 'dBFS RMS');
    expect(level, 'volume ' + String(volume) + ' is ' + toDb(volume).toFixed(2) + ' dB on the signal').toBeCloseTo(TONE_DBFS + toDb(volume), 1);
    // The bus is what goes to the output, and with one element it is that element.
    expect(toDb(rms(mix.left, mix.left.length - WINDOW))).toBeCloseTo(level, 2);
    expect(toDb(rms(mix.right, mix.right.length - WINDOW)), 'a mono file is in both channels').toBeCloseTo(level, 2);
  }
  expect((levels['1'] ?? 0) - (levels['0.5'] ?? 0), 'half volume is 6.02 dB').toBeCloseTo(6.02, 1);
  expect((levels['1'] ?? 0) - (levels[String(DUCK_RATIO)] ?? 0), 'the duck ratio is 9.12 dB').toBeCloseTo(-toDb(DUCK_RATIO), 1);
});

test('volume 0 and a paused element are exact digital silence, and silence is reported as zeros', async ({ page }) => {
  await setVolume(page, 0);
  await page.waitForTimeout(SETTLE_MS);
  let { mix } = await captured(page);
  expect(mix.quanta, 'the bus tap keeps reporting').toBeGreaterThan(100);
  expect(peak(mix.left, mix.left.length - WINDOW), 'volume 0').toBe(0);
  const silentUntil = mix.startFrame + mix.left.length;
  await setVolume(page, 1);
  await page.waitForTimeout(SETTLE_MS);
  expect(peak((await captured(page, silentUntil)).mix.left), 'and back: the zero above was the volume, not a dead tap').toBeGreaterThan(AMPLITUDE * 0.99);
  await page.evaluate(() => { (globalThis as unknown as ToneBrowser).__tone.pause(); });
  await page.waitForTimeout(SETTLE_MS);
  const from = await signalFrame(page) - WINDOW;
  ({ mix } = await captured(page, from));
  expect(mix.left.length).toBeGreaterThanOrEqual(WINDOW - 256);
  expect(peak(mix.left), 'paused').toBe(0);
});

test('one volume write is a step in the samples, within a few milliseconds', async ({ page }, info) => {
  await page.waitForTimeout(SETTLE_MS);
  const from = await signalFrame(page);
  await page.waitForTimeout(100);
  await setVolume(page, 0.5);
  await page.waitForTimeout(SETTLE_MS);
  const element = (await captured(page, from)).elements[0];
  if (!element) throw new Error('The tone element was not tapped.');
  // One period of the tone per reading: the amplitude over each millisecond.
  const period = SAMPLE_RATE / 1000;
  const amplitudes = Array.from({ length: Math.floor(element.left.length / period) }, (_, at) => peak(element.left, at * period, (at + 1) * period));
  const first = amplitudes.findIndex((value) => value < AMPLITUDE * 0.525);
  const last = amplitudes.slice(0, Math.max(first, 0)).reduce((found, value, at) => value > AMPLITUDE * 0.975 ? at : found, -1);
  expect(last, 'the tone was at full level first').toBeGreaterThanOrEqual(0);
  expect(first, 'and reached half').toBeGreaterThan(last);
  report(info, 'signal transition for one volume write', first - last, 'ms');
  // A step, not a glide: on this path Chromium applies a volume write to the very next samples,
  // so a ramp built from volume writes is a staircase in the signal and is measured as one.
  expect(first - last).toBeLessThanOrEqual(5);
});
