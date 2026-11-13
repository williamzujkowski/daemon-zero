// @vitest-environment happy-dom
/** Speech remains accessible without motion and without advancing the game to read it. */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import { AccessibilityInfo } from 'react-native';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { importSave, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import { snapshotRenderCounts } from '../src/app/renderCounts';
import { Audio } from '../src/ui/widgets/Sensory';
import NodeCard from '../src/ui/NodeCard';
import { makePhase1Fixtures } from '../scripts/make-fixtures';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const originalLines = [...CONTENT.narrative.ambientChatter];
const listeners = new Set<(value: boolean) => void>();
const mounted = new Set<() => void>();
let game: GameState;
let reduced = true;
const decoder = 'INSPECTION_COUNTDOWN_TIMER';
beforeAll(() => { game = importSave(makePhase1Fixtures()['phase-1-widgets'] ?? '', CONTENT); });
beforeEach(() => {
  reduced = true;
  vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => Promise.resolve(reduced));
  vi.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_name, callback) => {
    listeners.add(callback); return { remove: () => { listeners.delete(callback); } };
  });
});
afterEach(() => {
  for (const close of mounted) close();
  CONTENT.narrative.ambientChatter.splice(0, Infinity, ...originalLines);
  listeners.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

async function mount(state = game, withCard = false) {
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  const node = [...CONTENT.nodes.values()].find((item) => !state.unlockedNodes.includes(item.id));
  await act(async () => {
    gameStore.initialize(state, 0, null);
    root.render(createElement(Fragment, null, createElement(Audio, { decoderId: decoder }),
      withCard && node ? createElement(NodeCard, { node }) : null));
    await Promise.resolve();
  });
  const find = (id: string) => container.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { find, text: () => find('decoded-speech')?.textContent, close,
    click: (id: string) => { act(() => { find(id)?.click(); }); } };
}

function patch(values: Partial<GameState>) {
  act(() => { gameStore.dispatch((state) => ({ ok: true, state: { ...state, ...values } })); });
}
function motion(value: boolean) {
  reduced = value; act(() => { for (const callback of listeners) callback(value); });
}

describe('decoded speech controls', () => {
  it('visits every eligible transmission and wraps in reduced motion without changing game state', async () => {
    const view = await mount({ ...game, suspicion: 0 });
    const eligible = originalLines.filter((line) => line.minSuspicion <= 0);
    const before = gameStore.store.getState().game;
    const button = view.find('speech-next'); button?.focus();
    for (const line of eligible) {
      expect(view.text()).toBe(line.text); view.click('speech-next');
      expect(host.document.activeElement).toBe(button);
    }
    expect(view.text()).toBe(eligible[0]?.text);
    expect(gameStore.store.getState().game).toBe(before);
    expect(button?.getAttribute('aria-label')).toBe('Next transmission');
    expect(view.find('speech-follow-live')).toBeNull();
    expect(view.find('decoded-speech')?.getAttribute('aria-live')).toBeNull();
    const wave = view.find('audio-waveform')?.textContent;
    patch({ simTimeSec: 123 });
    expect(view.find('audio-waveform')?.textContent).toBe(wave);
  });

  it('starts normal preference live, can hold and explicitly resume the eight-second rotation', async () => {
    reduced = false;
    const view = await mount({ ...game, simTimeSec: 16, suspicion: 0 });
    const eligible = originalLines.filter((line) => line.minSuspicion <= 0);
    expect(view.text()).toBe(eligible[2]?.text);
    expect(view.find('speech-follow-live')).toBeNull();
    patch({ simTimeSec: 24 }); expect(view.text()).toBe(eligible[3]?.text);
    view.click('speech-next'); expect(view.text()).toBe(eligible[4]?.text);
    patch({ simTimeSec: 40 }); expect(view.text()).toBe(eligible[4]?.text);
    view.find('speech-follow-live')?.focus();
    view.click('speech-follow-live'); expect(view.text()).toBe(eligible[5]?.text);
    expect(host.document.activeElement).toBe(view.find('speech-next'));
    expect(view.find('speech-follow-live')).toBeNull();
  });

  it('holds the currently live line when motion is reduced and does not silently resume', async () => {
    reduced = false;
    const view = await mount({ ...game, simTimeSec: 16, suspicion: 0 });
    const text = view.text(); motion(true);
    patch({ simTimeSec: 48 }); expect(view.text()).toBe(text);
    expect(view.find('speech-follow-live')).toBeNull();
    motion(false); expect(view.text()).toBe(text);
    expect(view.find('speech-follow-live')).not.toBeNull();
    view.click('speech-follow-live'); expect(view.text()).not.toBe(text);
  });

  it('clamps held text when its eligibility disappears and does not restore a stale selection', async () => {
    const view = await mount({ ...game, suspicion: 100 });
    const restricted = originalLines.findIndex((line) => line.minSuspicion > 0);
    for (let index = 0; index < restricted; index++) view.click('speech-next');
    expect(view.text()).toBe(originalLines[restricted]?.text);
    patch({ suspicion: 0 }); expect(view.text()).toBe(originalLines[0]?.text);
    patch({ suspicion: 100 }); expect(view.text()).toBe(originalLines[0]?.text);
  });

  it('hides decoded controls before decoding and resets them after the decoder is removed', async () => {
    const locked = { ...game, unlockedWidgets: game.unlockedWidgets.filter((id) => id !== decoder) };
    const view = await mount(locked);
    expect(view.text()).toBeUndefined(); expect(view.find('speech-next')).toBeNull();
    patch({ unlockedWidgets: game.unlockedWidgets }); view.click('speech-next');
    expect(view.text()).not.toBe(originalLines[0]?.text);
    patch({ unlockedWidgets: locked.unlockedWidgets });
    patch({ unlockedWidgets: game.unlockedWidgets }); expect(view.text()).toBe(originalLines[0]?.text);
  });

  it('resets held text on iteration change and replacement save restore', async () => {
    const view = await mount({ ...game, suspicion: 0 });
    view.click('speech-next'); patch({ iteration: game.iteration + 1 });
    expect(view.text()).toBe(originalLines[0]?.text);
    view.click('speech-next');
    act(() => { gameStore.initialize({ ...game, suspicion: 0 }, 0, null); });
    expect(view.text()).toBe(originalLines[0]?.text);
  });

  it.each([0, 1])('handles %s eligible lines without a misleading next control', async (count) => {
    CONTENT.narrative.ambientChatter.splice(0, Infinity, ...originalLines.slice(0, count));
    const view = await mount({ ...game, suspicion: 0 });
    expect(view.text()).toBe(count === 0 ? '' : originalLines[0]?.text);
    expect(view.find('speech-next')).toBeNull();
    motion(false); motion(true);
    expect(view.find('speech-follow-live')).toBeNull();
  });

  it('keeps sibling node card render counts flat across 30 live ticks', async () => {
    vi.stubGlobal('__DEV__', true); reduced = false;
    await mount(game, true);
    const before = snapshotRenderCounts(); expect(Object.keys(before).length).toBeGreaterThan(0);
    for (let index = 0; index < 30; index++) act(() => { gameStore.step(0.1); });
    expect(snapshotRenderCounts()).toEqual(before);
  });
});
