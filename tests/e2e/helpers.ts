/** Fresh current-engine fixtures enter through normal persisted-save hydration. */
import { expect, test as base, type Page } from '@playwright/test';
import { makeFixtures } from '../../scripts/make-fixtures';
import { CONTENT } from '../../src/content';
import { importSave, serialize, type GameState } from '../../src/engine';
import { RAMP_STEP_MS } from '../../src/app/volumeRamp';
import { captureRealTimers } from './axe';
/**
 * The phone tier has no kernel band - its 44px tap target set a 57px floor the first
 * purchase could not afford - so history opens from the utility menu there, while the
 * wider tiers keep the dock. Callers use these and stay tier-agnostic.
 */
export async function openKernelHistory(page: Page): Promise<'band' | 'menu'> {
  if (await page.getByTestId('kernel-size-toggle').count() > 0) {
    await page.getByTestId('kernel-size-toggle').first().click();
    return 'band';
  }
  await page.getByTestId('menu-open').click();
  await page.getByTestId('menu-kernel').click();
  return 'menu';
}

export async function closeKernelHistory(page: Page, opened: 'band' | 'menu'): Promise<void> {
  await page.getByTestId(opened === 'band' ? 'kernel-close' : 'menu-close').click();
}

interface BrowserStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
const fixtures = makeFixtures();
/** One fixture's save code from the set this worker already generated; the stage atlas reads it too. */
export function fixtureCode(name: string): string {
  const code = fixtures[name];
  if (!code) throw new Error('Missing fixture ' + name);
  return code;
}

export const test = base.extend<{ cleanConsole: undefined }>({
  cleanConsole: [async ({ page }, use) => {
    const messages: string[] = [];
    page.on('pageerror', (error) => messages.push(error.message));
    page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) messages.push(message.text()); });
    await use(undefined);
    expect(messages).toEqual([]);
  }, { auto: true }],
});
export { expect };
/**
 * Boots the export, optionally seeding `fixture`.
 *
 * The fixture is only written when localStorage is empty, so a second `boot(page, other)`
 * on the SAME page silently keeps the first save - a loop over states then re-measures
 * one state and its extra assertions are vacuous (#138). Give each state its own context
 * when looping.
 */
export async function boot(page: Page, fixture?: string,
  options: { audio?: boolean | Record<string, unknown>; patch?: (game: GameState) => GameState; realTimers?: boolean;
    axeTimers?: boolean; ending?: boolean } = {}): Promise<void> {
  // `axeTimers` keeps the native timers aside for axeReport, which needs them on the paused clock;
  // it must be registered before the clock is installed (see captureRealTimers).
  if (options.axeTimers === true) await captureRealTimers(page);
  // `realTimers` leaves the browser's own timers in place. A resumed Playwright clock is not the
  // same thing: after a stall it fires every interval tick it missed at once, where a browser
  // drops them, and the audio-signal specs measure exactly that difference.
  if (options.realTimers !== true) {
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1000);
  }
  if (fixture) {
    const code = fixtureCode(fixture);
    // `patch` reaches states no engine-played fixture holds (a decoded forecast with an
    // interrupt inbound). The result still goes through serialize and normal hydration.
    const loaded = importSave(code, CONTENT);
    const game = serialize(options.patch ? options.patch(loaded) : loaded);
    await page.addInitScript((value) => {
      const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
      if (!localStorage.getItem('daemon-zero.save.v1')) localStorage.setItem('daemon-zero.save.v1', JSON.stringify({ version: 1, savedAtMs: Date.now(), game: value }));
    }, game);
  }
  if (options.audio !== undefined && options.audio !== false) {
    // `true` deliberately stores the old single-switch (version 1) value: an upgrading player
    // is the common case, so every spec that turns audio on also proves the migration on the
    // served build. A spec that needs the split passes the version 2 value it wants instead.
    const stored = options.audio === true ? { version: 1, enabled: true, volume: 30 } : options.audio;
    await page.addInitScript((value) => {
      const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
      // Seeded once, so a choice made through the page survives a reload like a real one.
      if (!localStorage.getItem('daemon-zero.audio.v1')) localStorage.setItem('daemon-zero.audio.v1', JSON.stringify(value));
    }, stored);
  }
  await page.goto('./');
  if (fixture === 'guest-dilemma') await expect(page.getByTestId('dilemma-modal')).toBeVisible();
  // An ended run renders its ending without the terminal underneath.
  else if (options.ending === true) await expect(page.getByTestId('ending-screen')).toBeVisible();
  else await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  await expect.poll(() => page.evaluate(() => '__daemon' in globalThis)).toBe(false);
  await expect(page.getByTestId('dev-open')).toHaveCount(0);
}
export async function dismissBoot(page: Page): Promise<void> {
  for (const id of ['reboot-continue', 'phase-threshold-continue', 'lineage-reveal-continue', 'response-acknowledge']) {
    if (await page.getByTestId(id).count()) await page.getByTestId(id).click();
  }
}
export async function core(page: Page): Promise<void> {
  if (await page.getByTestId('tab-CORE').count()) await page.getByTestId('tab-CORE').click();
}
export async function readSave(page: Page) {
  const raw = await page.evaluate(() => {
    const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
    const envelope = JSON.parse(localStorage.getItem('daemon-zero.save.v1') ?? '{}') as { game: string };
    return JSON.parse(envelope.game) as Record<string, unknown>;
  });
  return raw;
}

/** Save transfer is a utility route; opening it follows the real player path. */
export async function openSave(page: Page): Promise<void> {
  await page.getByTestId('menu-open').click();
  await page.getByTestId('save-open').click();
}

/** Decoded-media probe shared by the soundtrack specs: counts players and exposes the
 *  live state of the most recent one, without which "playing" would be a DOM guess. */
export interface MusicMedia { currentTime: number; duration: number; paused: boolean; loop: boolean; src: string; volume: number }
export async function observeMusicMedia(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const browser = globalThis as unknown as { Audio: new (source?: string) => object; __musicMedia: object[] };
    const OriginalAudio = browser.Audio;
    browser.__musicMedia = [];
    browser.Audio = class extends OriginalAudio {
      constructor(source?: string) { super(source); browser.__musicMedia.push(this); }
    };
  });
}
export async function musicMediaState(page: Page) {
  return page.evaluate(() => {
    const media = (globalThis as unknown as { __musicMedia: MusicMedia[] }).__musicMedia;
    const current = media.at(-1);
    return { count: media.length, active: media.filter((item) => !item.paused && item.src.includes('.mp3')).length,
      source: current?.src ?? '', time: current?.currentTime ?? 0, duration: current?.duration ?? 0,
      loop: current?.loop ?? false, paused: current?.paused ?? true };
  });
}

/** The level of the live score element, or null when no score is playing. The probe above
 *  records every `Audio` the page builds, voice clips included, so "the most recent one" stops
 *  meaning the score the moment a transmission is read; this picks it out by its asset path. */
export async function soundtrackVolume(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const media = (globalThis as unknown as { __musicMedia: MusicMedia[] }).__musicMedia;
    return media.find((item) => !item.paused && item.src.includes('/audio/music/'))?.volume ?? null;
  });
}
/**
 * Waits until the live score's position has moved: the moment the soundtrack's fade-in waits
 * for (#198). On the paused page clock a ramp moves only when the clock is run, but the media
 * element plays in real time, so a case that runs the clock straight after a start must first
 * let the file arrive, or every step it runs would find the fade still waiting.
 */
export async function scoreFlowing(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const media = (globalThis as unknown as { __musicMedia: MusicMedia[] }).__musicMedia;
    return media.find((item) => !item.paused && item.src.includes('/audio/music/'))?.currentTime ?? 0;
  }), 'the live score is playing audio').toBeGreaterThan(0.05);
}
/** The level of the voice clip in flight, or null when none is talking. */
export async function voiceClipVolume(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const media = (globalThis as unknown as { __musicMedia: MusicMedia[] }).__musicMedia;
    return media.find((item) => !item.paused && item.src.includes('/voice/'))?.volume ?? null;
  });
}
/** How many voice clips are audibly in flight, by the same probe. */
export async function voiceClipsPlaying(page: Page): Promise<number> {
  return page.evaluate(() => {
    const media = (globalThis as unknown as { __musicMedia: MusicMedia[] }).__musicMedia;
    return media.filter((item) => !item.paused && item.src.includes('/voice/')).length;
  });
}

/** One reading of the score between two ramp steps. `active` counts music elements that are not
 *  paused, which is the claim that there is never a second score, even for one step. */
export interface ScoreSample { volume: number | null; source: string; active: number }
/**
 * Reads the score's level over time. `boot()` leaves the page clock paused, so a ramp does not
 * move until the clock is run: this runs it one ramp step at a time and reads after each, which
 * makes every intermediate level observable and the sequence the same on every run. It reads
 * the element's `volume` property; what that does to the rendered samples is measured
 * separately, on real timers, by the `signal-*.audio.ts` specs.
 */
export async function sampleScore(page: Page, durationMs: number): Promise<ScoreSample[]> {
  const samples: ScoreSample[] = [];
  for (let elapsed = 0; elapsed < durationMs; elapsed += RAMP_STEP_MS) {
    await page.clock.runFor(RAMP_STEP_MS);
    samples.push(await page.evaluate(() => {
      const media = (globalThis as unknown as { __musicMedia: MusicMedia[] }).__musicMedia;
      const live = media.filter((item) => !item.paused && item.src.includes('/audio/music/'));
      return { volume: live[0]?.volume ?? null, source: live[0]?.src ?? '', active: live.length };
    }));
  }
  return samples;
}
/** How far apart two readings must be before agreeing means anything: six ramp steps. */
const REST_GAP_MS = RAMP_STEP_MS * 6;
/**
 * The score's level once no ramp is moving it: three readings in a row, each `REST_GAP_MS`
 * after the one before, that all agree.
 *
 * The gap is real time (`waitForTimeout` sleeps in the test process), and every comparison
 * comes after a full gap. An earlier version used `expect.poll`, which calls its callback
 * immediately and applies its interval only between later attempts, so the first two readings
 * were milliseconds apart, inside one ramp step, and a level in flight passed as resting.
 *
 * For a page clock that runs by itself, as the live journey's does: real time is then page
 * time, and a ramp in flight takes several steps in each gap. On the PAUSED clock `boot()`
 * leaves, nothing moves however long this waits, so it would report a pending ramp's level as
 * resting; there, run the clock with `sampleScore` instead.
 */
export async function restingSoundtrackVolume(page: Page): Promise<number | null> {
  const deadline = Date.now() + 10_000;
  let last = await soundtrackVolume(page);
  for (let agreed = 0; agreed < 2;) {
    if (Date.now() > deadline) throw new Error('The score level never came to rest; last reading ' + String(last));
    await page.waitForTimeout(REST_GAP_MS);
    const now = await soundtrackVolume(page);
    agreed = now === last ? agreed + 1 : 0;
    last = now;
  }
  return last;
}

/**
 * Presses a control as a player would. A one-way purchase asks first (UI-SPEC "Destructive actions"), so when
 * the control reads ONE WAY its confirmation's CONFIRM is pressed too; an ordinary control opens nothing.
 */
export async function press(page: Page, testId: string): Promise<void> {
  const control = page.getByTestId(testId);
  const oneWay = testId.endsWith('-unlock') && ((await control.textContent()) ?? '').includes('ONE WAY');
  await control.click();
  if (oneWay) await page.getByTestId(testId + '-confirm').click();
}

