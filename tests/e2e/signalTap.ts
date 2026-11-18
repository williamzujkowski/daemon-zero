/**
 * Captures the audio samples the served build renders, not properties of its media elements.
 *
 * Every `Audio` the page builds (expo-audio's web player builds them detached from the DOM) is
 * routed through one `AudioContext`: element -> `MediaElementAudioSourceNode` -> a bus ->
 * `destination`. An `AudioWorklet` on each element copies that element's samples, and one on the
 * bus copies the mix that is handed to the output. Chromium applies `element.volume` before the
 * source node; `signal-control.audio.ts` proves that on every run with a file of known level, and
 * without that control none of the level measurements would mean anything.
 *
 * Time: the context runs on the audio clock whatever the Playwright page clock is doing, and all
 * taps share its frame counter, so two captures are aligned to the sample. That clock is not the
 * wall clock the app writes its ramps on: while the output stops pulling (an audio device, or
 * headless Chromium's fake output thread starved of CPU on a loaded CI runner) time passes and no
 * samples are made (#244). So every quantum also carries when it was rendered, and waits for
 * samples are counted in samples (`settle`).
 */
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

export const SAMPLE_RATE = 48_000;
const ASSETS = path.resolve(__dirname, '../../assets');

/**
 * The committed file a `__reference/<path>` request names, or null for anything that would
 * resolve outside `assets/` (`..` segments, encoded or not, or an absolute path). The route is
 * test-only, but it serves files from the developer's disk to a page, so it serves only the
 * directory it exists for.
 */
export function referenceFile(url: string): string | null {
  const name = new URL(url).pathname.split('/__reference/')[1];
  if (name === undefined || name === '') return null;
  let decoded: string;
  try { decoded = decodeURIComponent(name); } catch { return null; }
  const file = path.resolve(ASSETS, decoded);
  return file.startsWith(ASSETS + path.sep) ? file : null;
}

/** One tapped source, on the context's frame timeline. `source` is the element's first `src`. */
export interface Capture {
  source: string; startFrame: number; left: Float32Array; right: Float32Array;
  /** How many render quanta the tap reported: zero means it never ran, not that it was silent. */
  quanta: number;
  /** Where the element was in its file when its first non-zero sample arrived. */
  audible: { frame: number; mediaSeconds: number } | null;
}
/** When each quantum of a capture was rendered, in ms of the render thread's wall clock (null if
 *  no tap reported it): `ms[i]` is the quantum that starts at frame `from + 128 * i`. */
export interface RenderedAt { from: number; ms: (number | null)[] }
export interface Captured { frame: number; mix: Capture; elements: Capture[]; renderedAt: RenderedAt }

/** The project compiles without the DOM library, so the few Web Audio shapes used are named here. */
interface Node_ { connect(target: unknown): void }
interface Quantum { frame: number; wall: number; left?: Float32Array; right?: Float32Array }
interface Decoded { sampleRate: number; length: number; numberOfChannels: number; getChannelData(channel: number): Float32Array }
interface Context {
  sampleRate: number; currentTime: number; state: string; destination: unknown;
  audioWorklet: { addModule(url: string): Promise<void> };
  createGain(): Node_; createMediaElementSource(element: unknown): Node_;
  createConstantSource(): Node_ & { offset: { value: number }; start(): void };
}
interface Media { src: string; currentTime: number; paused: boolean; ended: boolean }
interface Browser {
  Audio: new (source?: string) => Media; __signalTap: TapGlobal; location: { href: string };
  AudioContext: new (options: { sampleRate: number }) => Context;
  AudioWorkletNode: new (context: Context, name: string, options: object) => Node_ & { port: { onmessage: ((event: { data: Quantum }) => void) | null } };
  OfflineAudioContext: new (channels: number, length: number, rate: number) => { decodeAudioData(bytes: ArrayBuffer): Promise<Decoded> };
  Blob: new (parts: string[], options: { type: string }) => object;
  URL: { createObjectURL(blob: object): string };
}
interface TapRecord { source: string; element: Media | null; quanta: Quantum[]; audible: { frame: number; mediaSeconds: number } | null }
interface TapGlobal { context: Context; ready: Promise<void>; mix: TapRecord; taps: TapRecord[]; decoded: Map<string, Promise<Decoded>> }

/** Must run before `boot()`: the context and its worklet have to exist before the first element. */
export async function installSignalTap(page: Page): Promise<void> {
  // The reference a capture is compared with is the committed file, not whatever was served.
  await page.route('**/__reference/**', (route) => {
    const file = referenceFile(route.request().url());
    return file === null ? route.fulfill({ status: 403, body: 'outside assets/' }) : route.fulfill({ path: file });
  });
  await page.addInitScript((rate) => {
    const browser = globalThis as unknown as Browser;
    const context = new browser.AudioContext({ sampleRate: rate });
    // `wall` is read on the render thread as the quantum is made. The worklet scope has no
    // `performance`, so it is Date.now(): whole milliseconds, ample against 25 ms ramp steps.
    const processor = 'class Tap extends AudioWorkletProcessor { process(inputs) { const input = inputs[0]; const wall = Date.now();'
      + ' if (input.length === 0) this.port.postMessage({ frame: currentFrame, wall });'
      + ' else this.port.postMessage({ frame: currentFrame, wall, left: input[0].slice(), right: (input[1] || input[0]).slice() });'
      + ' return true; } } registerProcessor("signal-tap", Tap);';
    const ready = context.audioWorklet.addModule(browser.URL.createObjectURL(new browser.Blob([processor], { type: 'application/javascript' })));
    const bus = context.createGain();
    bus.connect(context.destination);
    const attach = (node: Node_, record: TapRecord): void => {
      void ready.then(() => {
        const tap = new browser.AudioWorkletNode(context, 'signal-tap', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 2, channelCountMode: 'explicit' });
        tap.port.onmessage = (event) => {
          record.quanta.push(event.data);
          if (record.audible === null && record.element !== null && event.data.left?.some((sample) => sample !== 0) === true) {
            record.audible = { frame: event.data.frame, mediaSeconds: record.element.currentTime };
          }
        };
        node.connect(tap);
      });
    };
    const mix: TapRecord = { source: 'mix', element: null, quanta: [], audible: null };
    // A constant zero keeps the bus rendering, so silence is reported as zeros rather than as nothing.
    const keepAlive = context.createConstantSource();
    keepAlive.offset.value = 0; keepAlive.connect(bus); keepAlive.start();
    attach(bus, mix);
    const taps: TapRecord[] = [];
    browser.__signalTap = { context, ready, mix, taps, decoded: new Map() };
    const OriginalAudio = browser.Audio;
    browser.Audio = class extends OriginalAudio {
      constructor(source?: string) {
        super(source);
        const record: TapRecord = { source: this.src, element: this, quanta: [], audible: null };
        taps.push(record);
        const node = context.createMediaElementSource(this);
        node.connect(bus);
        attach(node, record);
      }
    };
  }, SAMPLE_RATE);
}

/**
 * Answer Range requests for matching URLs with the served bytes. `python3 -m http.server`, which
 * serves the export in this suite, ignores Range, and Chromium then reports the media as
 * unseekable (`seekable` is [0, 0]): any seek lands on 0. Hosts that serve the game (GitHub
 * Pages) do honour Range, so this makes the test server behave like them, for seeking only.
 */
export async function serveByteRanges(page: Page, pattern: string): Promise<void> {
  const bodies = new Map<string, Promise<Buffer>>();
  await page.route(pattern, async (route) => {
    const url = route.request().url();
    let loading = bodies.get(url);
    if (!loading) { loading = route.fetch().then((response) => response.body()); bodies.set(url, loading); }
    const body = await loading;
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? '');
    const common = { 'accept-ranges': 'bytes', 'content-type': 'audio/mpeg' };
    if (!range) { await route.fulfill({ status: 200, headers: common, body }); return; }
    const first = Number(range[1]); const last = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
    await route.fulfill({ status: 206, body: body.subarray(first, last + 1),
      headers: { ...common, 'content-range': 'bytes ' + String(first) + '-' + String(last) + '/' + String(body.length) } });
  });
}

/** The tap is usable: the worklet module has loaded and the context is rendering. */
export async function signalTapReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const tap = (globalThis as unknown as Browser).__signalTap;
    await tap.ready;
    if (tap.context.state !== 'running') throw new Error('The capture context is ' + tap.context.state + ', so nothing would be measured.');
  });
}

/** The context frame now. Good to a render quantum or two; use it to bracket, not to time. */
export async function signalFrame(page: Page): Promise<number> {
  return page.evaluate(() => {
    const { context } = (globalThis as unknown as Browser).__signalTap;
    return Math.round(context.currentTime * context.sampleRate);
  });
}

/**
 * Wait `ms`, then until the context has also rendered `ms` of samples since the call. A wait for
 * samples to exist is counted in samples: a stalled output renders less than the wall time that
 * passed, and a capture taken after a wall-clock wait would then be short of what it measures.
 */
export async function settle(page: Page, ms: number): Promise<void> {
  const from = await signalFrame(page);
  await page.waitForTimeout(ms);
  await expect.poll(async () => await signalFrame(page) - from, { message: 'the output renders ' + String(ms) + ' ms of samples', timeout: 10_000 + ms })
    .toBeGreaterThanOrEqual(Math.round(ms / 1000 * SAMPLE_RATE));
}

/** How many tapped elements of a kind (a path fragment such as `/voice/`) are playing now. */
export async function playing(page: Page, kind: string): Promise<number> {
  return page.evaluate((fragment) => (globalThis as unknown as Browser).__signalTap.taps
    .filter((tap) => tap.source.includes(fragment) && tap.element !== null && !tap.element.paused && !tap.element.ended).length, kind);
}

function floats(encoded: string): Float32Array {
  const bytes = Buffer.from(encoded, 'base64');
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4).slice();
}

/** Everything captured from `fromFrame` on: the output mix and each element separately. */
export async function captured(page: Page, fromFrame = 0): Promise<Captured> {
  const raw = await page.evaluate((from) => {
    const { context, mix, taps } = (globalThis as unknown as Browser).__signalTap;
    const frame = Math.round(context.currentTime * context.sampleRate);
    const encode = (samples: Float32Array): string => {
      const bytes = new Uint8Array(samples.buffer);
      let text = '';
      for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
      return btoa(text);
    };
    // One window for every tap, set by the output tap, so all captures line up index for index;
    // a tap that did not exist yet, or had nothing connected, is zeros there.
    const reported = mix.quanta.filter((quantum) => quantum.frame + 128 > from);
    const start = Math.max(from, reported[0]?.frame ?? frame);
    const end = Math.max(start, (reported.at(-1)?.frame ?? start - 128) + 128);
    const flatten = (record: TapRecord) => {
      const quanta = record.quanta.filter((quantum) => quantum.frame + 128 > start && quantum.frame < end);
      const left = new Float32Array(end - start); const right = new Float32Array(end - start);
      for (const quantum of quanta) {
        if (!quantum.left || !quantum.right) continue;
        const skip = Math.max(0, start - quantum.frame);
        const keep = Math.min(128, end - quantum.frame);
        left.set(quantum.left.subarray(skip, keep), quantum.frame + skip - start);
        right.set(quantum.right.subarray(skip, keep), quantum.frame + skip - start);
      }
      return { source: record.source, startFrame: start, left: encode(left), right: encode(right), quanta: quanta.length, audible: record.audible };
    };
    // The bus tap reports every quantum the context renders, so its stamps are the render clock.
    const first = Math.floor(start / 128) * 128;
    const ms: (number | null)[] = Array.from({ length: Math.ceil((end - first) / 128) }, () => null);
    for (const quantum of reported) if (quantum.frame >= first && quantum.frame < end) ms[Math.floor((quantum.frame - first) / 128)] = quantum.wall;
    return { frame, mix: flatten(mix), elements: taps.map(flatten), renderedAt: { from: first, ms } };
  }, fromFrame);
  const decode = (item: typeof raw.mix): Capture => ({ ...item, left: floats(item.left), right: floats(item.right) });
  return { frame: raw.frame, mix: decode(raw.mix), elements: raw.elements.map(decode), renderedAt: raw.renderedAt };
}

/** The committed file behind a served asset URL, as a path under `assets/`. */
export function assetPath(source: string): string {
  const match = /assets\/(audio\/(?:music|voice)\/[^?]+?)\.[0-9a-f]{32}\.(mp3)/.exec(source);
  if (!match?.[1]) throw new Error('Not a bundled audio asset: ' + source);
  return match[1] + '.mp3';
}

/**
 * Mono samples of a committed file, decoded by the same browser at the capture rate. The bytes
 * come from the repository (`assets/<asset>`), so a capture that matches them is that file.
 */
export async function reference(page: Page, asset: string, fromSeconds: number, seconds: number): Promise<Float32Array> {
  return floats(await page.evaluate(async ([name, from, length]) => {
    const tap = (globalThis as unknown as Browser).__signalTap;
    let decoding = tap.decoded.get(name);
    if (!decoding) {
      decoding = fetch(new URL('__reference/' + name, (globalThis as unknown as Browser).location.href)).then((response) => response.arrayBuffer())
        .then((bytes) => new (globalThis as unknown as Browser).OfflineAudioContext(2, 1, tap.context.sampleRate).decodeAudioData(bytes));
      tap.decoded.set(name, decoding);
    }
    const buffer = await decoding;
    const start = Math.max(0, Math.round(from * buffer.sampleRate));
    const end = Math.min(buffer.length, start + Math.round(length * buffer.sampleRate));
    const mono = new Float32Array(Math.max(0, end - start));
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let at = start; at < end; at++) mono[at - start] = (mono[at - start] ?? 0) + (data[at] ?? 0) / buffer.numberOfChannels;
    }
    const bytes = new Uint8Array(mono.buffer);
    let text = '';
    for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
    return btoa(text);
  }, [asset, fromSeconds, seconds] as const));
}
