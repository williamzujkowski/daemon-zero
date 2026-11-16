// @vitest-environment happy-dom
/**
 * #185: a second app root mounted before the first one unmounts must leave audio working.
 * That is the order an Android activity recreation produced on the emulator (a font-size
 * change). This models the order with two react-dom roots in happy-dom; it does not exercise
 * Android, React Native's surface manager or a real audio backend.
 */
import type { HTMLElement } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
const audio = vi.hoisted(() => ({ players: [] as { play: () => void; status: (playing: boolean, error: boolean) => void }[] }));
vi.mock('../src/app/audioPlayer', () => ({ prepareMusic: () => Promise.resolve(), ensureAudioMode: () => Promise.resolve(),
  createMusicPlayer: (_phase: number, status: (playing: boolean, error: boolean) => void) => {
    const player = { play: vi.fn(), pause: vi.fn(), volume: vi.fn(), remove: vi.fn(), status };
    audio.players.push(player);
    return player;
  } }));
import { gameStore } from '../src/app/session';
import { music } from '../src/app/musicSession';
import TerminalScreen from '../src/ui/TerminalScreen';
import { host, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
// A failed case must not leave its second root mounted under the next one.
const open = new Set<() => void>();
afterEach(() => { for (const close of open) close(); });
const CONTROLS = ['music-toggle', 'music-quieter', 'music-louder', 'speech-toggle', 'speech-quieter', 'speech-louder'];
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
/** Read from the whole document: the menu is a modal outside its root's container, and by the
 *  time anything below is read the first root is gone, so every match is the second root's. */
const find = (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
function click(id: string) {
  const control = find(id);
  if (!control) throw new Error('Missing ' + id);
  act(() => { control.click(); });
}

/** The app as a player has it open: a desktop pane showing a transmission that has a recording. */
async function firstRoot() {
  const view = await mountM4('phase-1-widgets');
  // Suspicion picks the transmission; at zero it is the first line, which has a clip.
  await act(async () => { gameStore.initialize({ ...m4State('phase-1-widgets'), suspicion: 0 }, 0, null); await vi.advanceTimersByTimeAsync(0); });
  expect(view.find('speech-read'), 'READ is on screen before the second root exists').not.toBeNull();
  expect(music.state.getState().loaded).toBe(true);
  return view;
}

function secondRoot() {
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const mounted = createRoot(container);
  const close = () => { open.delete(close); act(() => { mounted.unmount(); }); container.remove(); };
  open.add(close);
  return { render: () => { mounted.render(createElement(TerminalScreen)); }, close };
}

/** The symptoms of #185, checked on what is left once the first root has gone. */
async function expectAudioWorks() {
  expect(host.document.querySelectorAll('[data-testid="terminal-screen"]').length, 'one root left').toBe(1);
  expect(find('speech-read'), 'READ is offered').not.toBeNull();
  click('menu-open'); click('menu-audio');
  for (const id of CONTROLS) expect(find(id)?.hasAttribute('disabled'), id + ' is enabled').toBe(false);
  expect(find('music-toggle')?.getAttribute('aria-checked')).toBe('true');
  expect(find('speech-toggle')?.getAttribute('aria-checked')).toBe('true');
  expect(find('speech-status')?.textContent).toContain('READ is offered');
  expect(find('music-status')?.textContent).toBe('Music is paused. Resume to start listening.');
  const before = audio.players.length;
  click('music-resume');
  await flush();
  expect(audio.players.length, 'RESUME MUSIC creates a player').toBe(before + 1);
  const player = audio.players.at(-1);
  expect(player?.play).toHaveBeenCalledOnce();
  act(() => { player?.status(true, false); });
  expect(find('music-status')?.textContent).toMatch(/^Playing phase \d score\.$/);
}

it('keeps MENU > Audio and READ working when the first root unmounts in the same pass the second mounts', async () => {
  const first = await firstRoot(), second = secondRoot();
  // No await between the two: the second root's effects run, then the first root's cleanups,
  // and the second root's preference load has not resolved yet.
  act(() => { second.render(); });
  first.close();
  await flush();
  await expectAudioWorks();
  second.close();
});

it('keeps them working when the first root unmounts after the second has loaded its preference', async () => {
  const first = await firstRoot(), second = secondRoot();
  await act(async () => { second.render(); await vi.advanceTimersByTimeAsync(0); });
  first.close();
  await flush();
  await expectAudioWorks();
  second.close();
});
