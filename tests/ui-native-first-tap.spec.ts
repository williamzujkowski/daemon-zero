// @vitest-environment happy-dom
/**
 * #249: on native a stored "music on" starts the score at the player's first touch on the
 * terminal, as the web does at its first gesture, and nothing plays before it. This mounts the
 * real screen through react-native-web with `Platform.OS` reporting Android, so the touch goes
 * through the root view's responder probe and not the document listeners; it does not exercise
 * Android's own touch dispatch or a native audio backend (docs/SOUNDTRACK.md has the emulator run).
 */
import type { HTMLElement } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Platform } from 'react-native';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const audio = vi.hoisted(() => ({ players: [] as { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> }[] }));
vi.mock('../src/app/audioPlayer', () => ({ prepareMusic: () => Promise.resolve(), ensureAudioMode: () => Promise.resolve(),
  createMusicPlayer: () => {
    let at = 0;
    const player = { play: vi.fn(), pause: vi.fn(), volume: vi.fn(), remove: vi.fn(), position: () => (at += 0.025), duration: () => 0 };
    audio.players.push(player);
    return player;
  } }));
vi.mock('expo-haptics', () => ({ impactAsync: () => Promise.resolve(), notificationAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Warning: 'warning' } }));
import { AUDIO_KEY } from '../src/app/audioPreferences';
import { music } from '../src/app/musicSession';
import TerminalScreen from '../src/ui/TerminalScreen';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
const os = Platform.OS;
beforeEach(() => { audio.players.length = 0; (Platform as { OS: string }).OS = 'android'; });
afterEach(() => { (Platform as { OS: string }).OS = os; });

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const find = (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
/** A finger landing on `id`: the start event react-native-web's responder system turns into
 *  the capture-phase negotiation that React Native runs for a native touch. */
async function touch(id: string) {
  const target = find(id);
  if (!target) throw new Error('Missing ' + id);
  act(() => { target.dispatchEvent(new host.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })); });
  act(() => { target.dispatchEvent(new host.MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 })); });
  await flush();
}
const store = (enabled: boolean) => { host.localStorage.setItem(AUDIO_KEY, JSON.stringify({ version: 2, enabled, volume: 30, speechEnabled: true, speechVolume: 30 })); };
const stored = () => JSON.parse(host.localStorage.getItem(AUDIO_KEY) ?? 'null') as { enabled: boolean } | null;

it('plays nothing before a touch, starts the score on the first one, and leaves the touch to the pressed control', async () => {
  const view = await mountM4('tick-0', { width: 390, height: 844 });
  await flush();
  expect(music.state.getState()).toMatchObject({ enabled: true, loaded: true, activated: false });
  expect(audio.players, 'no player before any interaction').toHaveLength(0);
  // The web path is not armed on native: a document-level gesture starts nothing.
  act(() => { host.document.dispatchEvent(new host.Event('pointerdown')); });
  await flush();
  expect(audio.players).toHaveLength(0);
  await touch('terminal-hud');
  expect(music.state.getState().activated).toBe(true);
  expect(audio.players).toHaveLength(1);
  expect(audio.players[0]?.play).toHaveBeenCalledOnce();
  // The probe never claims the touch, so the next press still reaches its control.
  view.click('menu-open'); view.click('menu-audio');
  expect(find('menu-audio-page')).not.toBeNull();
  expect(find('music-intro')?.textContent).toContain('first tap in the game, never before');
  view.close();
});

it('treats a media-key pause as this session only: a later touch does not restart it and the preference stays on', async () => {
  const view = await mountM4('tick-0', { width: 390, height: 844 });
  await flush();
  await touch('terminal-hud');
  expect(audio.players).toHaveLength(1);
  act(() => { music.remote('pause'); });
  expect(music.state.getState()).toMatchObject({ enabled: true, activated: false });
  await touch('terminal-hud');
  expect(music.state.getState().activated, 'a tap is not a resume once the score has started').toBe(false);
  expect(audio.players[0]?.play).toHaveBeenCalledOnce();
  view.click('menu-open'); view.click('menu-audio');
  expect(find('music-status')?.textContent).toBe('Music is paused. Resume to start listening.');
  expect(find('music-resume')).not.toBeNull();
  // Nothing was written: a fresh install has no stored value, and a pause must not create one.
  expect(stored()).toBeNull();
  view.close();
});

/** A second app root over the same document, as an Android activity recreation mounts one. */
function secondRoot() {
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const mounted = createRoot(container);
  const close = () => { act(() => { mounted.unmount(); }); container.remove(); };
  return { render: () => { act(() => { mounted.render(createElement(TerminalScreen)); }); }, close };
}

/** The first input each platform listens for: a touch on the terminal, or any document gesture. */
async function firstInput(platform: string) {
  if (platform === 'web') {
    act(() => { host.document.dispatchEvent(new host.Event('pointerdown')); });
    await flush();
    return;
  }
  // After the first root is gone, every terminal left in the document is the second root's.
  await touch('terminal-hud');
}

// Panel round 1 (#253): the new root's child effect armed the listener while the old root's
// controller still read activated, so it detached at once; the parent's start() then reset
// activated and nothing listened again. The order below is the one #185 recorded on Android.
it.each(['android', 'web'])('re-arms the first input for a root that replaces an active one (%s)', async (platform) => {
  (Platform as { OS: string }).OS = platform;
  const first = await mountM4('tick-0', { width: 390, height: 844 });
  await flush();
  await firstInput(platform);
  expect(music.state.getState().activated).toBe(true);
  expect(audio.players).toHaveLength(1);
  const second = secondRoot();
  second.render();
  first.close();
  await flush();
  expect(music.state.getState()).toMatchObject({ loaded: true, enabled: true, activated: false });
  await firstInput(platform);
  expect(music.state.getState().activated, 'the replacing root starts the score at its first input').toBe(true);
  expect(audio.players.at(-1)?.play).toHaveBeenCalled();
  second.close();
});

it('stays silent through every touch when music is stored off', async () => {
  store(false);
  const view = await mountM4('tick-0', { width: 390, height: 844 });
  await flush();
  expect(music.state.getState()).toMatchObject({ enabled: false, loaded: true });
  await touch('terminal-hud');
  await touch('terminal-hud');
  expect(music.state.getState().activated).toBe(false);
  expect(audio.players).toHaveLength(0);
  expect(stored()?.enabled).toBe(false);
  view.close();
});
