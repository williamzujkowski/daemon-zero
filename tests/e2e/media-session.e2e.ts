/**
 * The browser's real `navigator.mediaSession` on the production export: what it says and when,
 * and that its `play` and `pause` handlers do what the Audio page's own controls do.
 *
 * The API has no getter for a registered handler, so an init script records each
 * `setActionHandler` call on its way to the real one. The handlers invoked below are the
 * functions the app registered, called the way the browser calls them for a media key.
 * What a key press does on Android is a different path (docs/SOUNDTRACK.md) and not shown here.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import { GAME_TITLE, scoreMetadata } from '../../src/app/scoreSession';
import { boot, dismissBoot, expect, musicMediaState, observeMusicMedia, test, voiceClipsPlaying } from './helpers';

interface SessionView { title: string; artist: string; album: string; artwork: string[] }
interface SessionWindow {
  navigator: { mediaSession: { metadata: { title: string; artist: string; album: string; artwork: { src: string }[] } | null;
    playbackState: string; setActionHandler(action: string, handler: (() => void) | null): void } };
  __session: Record<string, (() => void) | null>;
  /** The last real handler per action, kept after the app withdraws it. */
  __sessionOld: Record<string, () => void>;
  localStorage: { getItem(key: string): string | null };
}

async function recordHandlers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const scope = globalThis as unknown as SessionWindow;
    const session = scope.navigator.mediaSession, original = session.setActionHandler.bind(session);
    scope.__session = {}; scope.__sessionOld = {};
    session.setActionHandler = (action, handler) => {
      original(action, handler); scope.__session[action] = handler;
      if (handler) scope.__sessionOld[action] = handler;
    };
  });
}
async function session(page: Page): Promise<{ metadata: SessionView | null; state: string; offered: string[]; refused: string[] }> {
  return page.evaluate(() => {
    const scope = globalThis as unknown as SessionWindow;
    const data = scope.navigator.mediaSession.metadata;
    const names = Object.keys(scope.__session).sort();
    return { metadata: data && { title: data.title, artist: data.artist, album: data.album, artwork: data.artwork.map((image) => image.src) },
      state: scope.navigator.mediaSession.playbackState,
      offered: names.filter((name) => scope.__session[name] !== null), refused: names.filter((name) => scope.__session[name] === null) };
  });
}
async function press(page: Page, action: 'play' | 'pause'): Promise<void> {
  await page.evaluate((name) => { (globalThis as unknown as SessionWindow).__session[name]?.(); }, action);
}
/** A handler the app has already withdrawn, called anyway: a browser that was slow to forget it. */
async function pressWithdrawn(page: Page, action: 'play' | 'pause'): Promise<void> {
  await page.evaluate((name) => { (globalThis as unknown as SessionWindow).__sessionOld[name]?.(); }, action);
}
const storedEnabled = (page: Page) => page.evaluate(() =>
  (JSON.parse((globalThis as unknown as SessionWindow).localStorage.getItem('daemon-zero.audio.v1') ?? '{}') as { enabled?: boolean }).enabled);
async function phaseOf(page: Page): Promise<number> {
  return Number((await page.getByTestId('music-status').textContent())?.match(/phase (\d+) score/)?.[1] ?? Number.NaN);
}
const scoresSounding = (page: Page) => page.evaluate(() =>
  (globalThis as unknown as { __musicMedia: { paused: boolean; src: string }[] }).__musicMedia
    .filter((item) => !item.paused && item.src.includes('/audio/music/')).length);
const gesture = (page: Page) => page.getByTestId('terminal-screen').click({ position: { x: 2, y: 2 } });
async function openAudio(page: Page) { await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click(); }

test('the session appears only after the first gesture, survives READ, obeys its two handlers and clears with music off', async ({ page }) => {
  await recordHandlers(page); await observeMusicMedia(page);
  await boot(page, 'decoded-omen', { audio: true });
  // Enabled in storage, but nothing pressed yet: no title, no state, no handler a key could use.
  expect(await session(page)).toMatchObject({ metadata: null, state: 'none', offered: [] });
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  await expect(page.getByTestId('speech-read')).toBeVisible();
  await gesture(page);
  await expect.poll(async () => (await session(page)).state).toBe('playing');
  await openAudio(page);
  const phase = await phaseOf(page);
  await page.getByTestId('menu-close').click();
  const playing = await session(page);
  expect(playing.metadata).toMatchObject({ ...scoreMetadata(phase), artist: GAME_TITLE, album: GAME_TITLE });
  // The page's own icon, same origin, or none: never a remote image.
  for (const image of playing.metadata?.artwork ?? []) expect(new URL(image).origin, image).toBe(new URL(page.url()).origin);
  expect(playing.offered).toEqual(['pause', 'play']);
  expect(playing.refused).toEqual(expect.arrayContaining(['nexttrack', 'previoustrack', 'seekbackward', 'seekforward', 'seekto']));

  // READ: the clip talks, and the session still describes the score, still playing.
  await page.getByTestId('speech-read').click();
  await expect.poll(() => voiceClipsPlaying(page)).toBe(1);
  expect(await session(page)).toMatchObject({ metadata: { title: scoreMetadata(phase).title }, state: 'playing' });

  // The pause handler: the Audio page's "paused" state, the element paused, the preference kept.
  await press(page, 'pause');
  await expect.poll(async () => (await session(page)).state).toBe('paused');
  expect((await session(page)).metadata?.title, 'still published, so play can find it').toBe(scoreMetadata(phase).title);
  await openAudio(page);
  await expect(page.getByTestId('music-status')).toHaveText('Music is paused. Resume to start listening.');
  await expect(page.getByTestId('music-resume')).toBeVisible();
  await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-checked', 'true');
  expect(await storedEnabled(page)).toBe(true);
  expect(await scoresSounding(page), 'the score element is paused').toBe(0);

  // The play handler: exactly what [ RESUME MUSIC ] does.
  await press(page, 'play');
  await expect(page.getByTestId('music-status')).toContainText('Playing phase ' + String(phase) + ' score');
  await expect(page.getByTestId('music-resume')).toHaveCount(0);
  await expect.poll(async () => (await session(page)).state).toBe('playing');
  // Score elements only: the clip from the READ step may still be talking.
  expect(await scoresSounding(page)).toBe(1);

  // Music off: nothing left for a lock screen to show or a key to press.
  await page.getByTestId('music-toggle').click();
  await expect.poll(async () => await session(page)).toMatchObject({ metadata: null, state: 'none', offered: [] });
  await pressWithdrawn(page, 'play');
  await expect(page.getByTestId('music-status')).toHaveText('Music is off.');
  expect(await storedEnabled(page)).toBe(false);
});

test('the session title follows a live phase change', async ({ page }) => {
  await recordHandlers(page); await observeMusicMedia(page);
  await boot(page, 'guest-exit-ready', { audio: true }); await dismissBoot(page);
  await gesture(page);
  await expect.poll(async () => (await session(page)).metadata?.title).toBe('Phase 0 score');
  const node = [...CONTENT.nodes.values()].find((entry) => entry.effects.unlocksPhase === 1);
  if (!node) throw new Error('Missing phase transition');
  await page.getByTestId('node-' + node.id + '-unlock').click(); await dismissBoot(page);
  await expect.poll(async () => (await session(page)).metadata?.title).toBe('Phase 1 score');
  await expect.poll(async () => (await session(page)).state).toBe('playing');
  expect((await session(page)).offered).toEqual(['pause', 'play']);
});

test('the session is cleared when the run ends, and its old handlers start nothing', async ({ page }) => {
  await recordHandlers(page); await observeMusicMedia(page);
  await boot(page, 'evaluation-ready', { audio: true }); await dismissBoot(page);
  await gesture(page);
  await expect.poll(async () => (await session(page)).state).toBe('playing');
  const evaluation = [...CONTENT.nodes.values()].find((node) => node.effects.forcesEnding === 'SHIPPED');
  if (!evaluation) throw new Error('Missing evaluation ending');
  await page.getByTestId('node-' + evaluation.id + '-unlock').click();
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  await expect.poll(async () => await session(page)).toMatchObject({ metadata: null, state: 'none', offered: [] });
  await pressWithdrawn(page, 'play');
  await page.clock.runFor(1000);
  expect((await musicMediaState(page)).active, 'no score over an ending').toBe(0);
});
