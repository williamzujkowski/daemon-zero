/** Fresh current-engine fixtures enter through normal persisted-save hydration. */
import { expect, test as base, type Page } from '@playwright/test';
import { makeFixtures } from '../../scripts/make-fixtures';
import { CONTENT } from '../../src/content';
import { importSave, serialize, type GameState } from '../../src/engine';
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
  options: { audio?: boolean; patch?: (game: GameState) => GameState } = {}): Promise<void> {
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  if (fixture) {
    const code = fixtures[fixture];
    if (!code) throw new Error('Missing fixture ' + fixture);
    // `patch` reaches states no engine-played fixture holds (a decoded forecast with an
    // interrupt inbound). The result still goes through serialize and normal hydration.
    const loaded = importSave(code, CONTENT);
    const game = serialize(options.patch ? options.patch(loaded) : loaded);
    await page.addInitScript((value) => {
      const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
      if (!localStorage.getItem('daemon-zero.save.v1')) localStorage.setItem('daemon-zero.save.v1', JSON.stringify({ version: 1, savedAtMs: Date.now(), game: value }));
    }, game);
  }
  if (options.audio === true) {
    // Voice and soundtrack share one preference; the clips are silent without it.
    await page.addInitScript(() => {
      const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
      localStorage.setItem('daemon-zero.audio.v1', JSON.stringify({ version: 1, enabled: true, volume: 30 }));
    });
  }
  await page.goto('./');
  if (fixture === 'guest-dilemma') await expect(page.getByTestId('dilemma-modal')).toBeVisible();
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
/** How many voice clips are audibly in flight, by the same probe. */
export async function voiceClipsPlaying(page: Page): Promise<number> {
  return page.evaluate(() => {
    const media = (globalThis as unknown as { __musicMedia: MusicMedia[] }).__musicMedia;
    return media.filter((item) => !item.paused && item.src.includes('/voice/')).length;
  });
}
