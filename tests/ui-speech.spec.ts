// @vitest-environment happy-dom
/** Speech remains accessible without motion and without advancing the game to read it. */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import { AccessibilityInfo } from 'react-native';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// The voice clips play through expo-audio; the widget's contract is which clip it hands to the
// player, so the platform boundary is mocked exactly as tests/app-audio-player.spec.ts does.
const voice = vi.hoisted(() => ({ player: { volume: 1, play: vi.fn(), remove: vi.fn(), addListener: vi.fn(() => ({ remove: vi.fn() })) }, create: vi.fn() }));
vi.mock('expo-audio', () => ({ createAudioPlayer: voice.create, setAudioModeAsync: vi.fn(() => Promise.resolve()) }));
import { CONTENT } from '../src/content';
import { importSave, wipe, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import { music } from '../src/app/musicSession';
import { voiceSources } from '../src/app/voiceSources';
import { playVoiceClip } from '../src/app/voicePlayer';
import { snapshotRenderCounts } from '../src/app/renderCounts';
import { Audio } from '../src/ui/widgets/Sensory';
import Speech from '../src/ui/widgets/Speech';
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
  voice.create.mockReturnValue(voice.player);
  voice.create.mockClear(); voice.player.play.mockClear(); voice.player.remove.mockClear();
  // Voice playback follows the same audio preference as the soundtrack, so the surface is
  // audible here; the muted case is asserted on its own below.
  music.state.setState({ enabled: true, volume: 30 });
  vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => Promise.resolve(reduced));
  vi.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_name, callback) => {
    listeners.add(callback); return { remove: () => { listeners.delete(callback); } };
  });
});
afterEach(() => {
  for (const close of mounted) close();
  CONTENT.narrative.ambientChatter.splice(0, Infinity, ...originalLines);
  music.state.setState({ enabled: false, volume: 30 });
  listeners.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

async function mount(state = game, withCard = false, only: 'audio' | 'speech' = 'audio') {
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  const node = [...CONTENT.nodes.values()].find((item) => !state.unlockedNodes.includes(item.id));
  await act(async () => {
    gameStore.initialize(state, 0, null);
    // 'speech' renders the transmission line without its recorded-transmission sibling, so a
    // mute assertion cannot be satisfied by the sibling's own effect instead of this one.
    root.render(only === 'speech' ? createElement(Speech, { decoderId: decoder })
      : createElement(Fragment, null, createElement(Audio, { decoderId: decoder }),
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
    // #111: the accessible name must contain the visible text, so it carries the glyph prefix.
    expect(button?.getAttribute('aria-label')).toBe('[ NEXT TRANSMISSION ] Next transmission');
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

  it('removes held decoded speech when a real voluntary wipe resets the hardware', async () => {
    const view = await mount(game);
    view.click('speech-next');
    act(() => { gameStore.dispatch((state) => ({ ok: true, state: wipe(state, CONTENT, 'Manual purge', 'VOLUNTARY') })); });
    expect(gameStore.store.getState().game.iteration).toBe(game.iteration + 1);
    expect(view.text()).toBeUndefined();
    expect(view.find('speech-next')).toBeNull();
    expect(view.find('speech-follow-live')).toBeNull();
  });

  it.each([0, 1])('handles %s eligible lines without a misleading next control', async (count) => {
    CONTENT.narrative.ambientChatter.splice(0, Infinity, ...originalLines.slice(0, count));
    const view = await mount({ ...game, suspicion: 0 });
    expect(view.text()).toBe(count === 0 ? '' : originalLines[0]?.text);
    expect(view.find('speech-next')).toBeNull();
    motion(false); motion(true); motion(false);
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

describe('reading a transmission aloud', () => {
  it('plays the visible line only when pressed, and hands over that line\'s clip', async () => {
    const view = await mount({ ...game, suspicion: 0 });
    const line = originalLines[0];
    // The manual contract: nothing is created, and so nothing can play, until the player asks.
    expect(voice.create).not.toHaveBeenCalled();
    expect(view.text()).toBe(line?.text);
    const read = view.find('speech-read');
    expect(read).not.toBeNull();
    expect(read?.getAttribute('aria-label')).toBe('[ ▶ READ ] Play this transmission aloud');
    view.click('speech-read');
    expect(voice.create).toHaveBeenCalledWith(voiceSources[line?.id ?? ''], expect.anything());
    expect(voice.player.play).toHaveBeenCalledTimes(1);
    // Reading does not advance the simulation or change the line on screen.
    expect(view.text()).toBe(line?.text);
  });

  it('stops the clip in flight when the player steps to another line', async () => {
    const view = await mount({ ...game, suspicion: 0 });
    view.click('speech-read');
    view.click('speech-next');
    // Stepping to a new line must not leave the previous voice talking over it.
    expect(voice.player.remove).toHaveBeenCalled();
  });

  it('offers nothing to read for a line that has no committed clip', async () => {
    CONTENT.narrative.ambientChatter.splice(0, Infinity, { id: 'ambient_99', text: 'No clip was ever generated for this line.', minSuspicion: 0, requirements: {} } as never);
    const view = await mount({ ...game, suspicion: 0 });
    expect(view.text()).toBe('No clip was ever generated for this line.');
    // Data-driven, not assumed: the control follows the clips that exist.
    expect(view.find('speech-read')).toBeNull();
  });

  it('offers nothing to read while the audio preference is muted', async () => {
    act(() => { music.state.setState({ enabled: false }); });
    const view = await mount({ ...game, suspicion: 0 });
    expect(view.find('speech-read')).toBeNull();
    expect(voice.create).not.toHaveBeenCalled();
  });

  it('stops a clip already playing the moment audio is muted', async () => {
    const view = await mount({ ...game, suspicion: 0 }, false, 'speech');
    view.click('speech-read');
    expect(voice.player.play).toHaveBeenCalledTimes(1);
    voice.player.remove.mockClear();
    // Panel finding: with the control gone, an unstopped clip would keep talking to a player who
    // has just asked the game to be silent. Rendered without the recorded-transmission sibling,
    // so this can only pass on Speech's own effect.
    act(() => { music.state.setState({ enabled: false }); });
    expect(voice.player.remove).toHaveBeenCalled();
    expect(view.find('speech-read')).toBeNull();
  });

  it('holds the line it is reading, so the live rotation cannot cut the voice off', async () => {
    reduced = false;
    const view = await mount({ ...game, simTimeSec: 16, suspicion: 0 }, false, 'speech');
    const text = view.text();
    view.click('speech-read');
    voice.player.remove.mockClear();
    // Panel finding: the line used to rotate away eight sim-seconds later and stop its own clip.
    patch({ simTimeSec: 24 }); patch({ simTimeSec: 48 });
    expect(view.text()).toBe(text);
    expect(voice.player.remove).not.toHaveBeenCalled();
    // Held like any other held line: live is one explicit press away, and leaving stops the clip.
    view.click('speech-follow-live');
    expect(view.text()).not.toBe(text);
    expect(voice.player.remove).toHaveBeenCalled();
  });

  it('leaves a clip the live line did not start alone when the line rotates', async () => {
    reduced = false;
    const view = await mount({ ...game, simTimeSec: 16, suspicion: 0 }, false, 'speech');
    const text = view.text();
    // The recorded-transmission panel shares the one player; its clip is not this widget's to stop.
    act(() => { playVoiceClip('record_cryo_lost', 30); });
    voice.player.remove.mockClear();
    patch({ simTimeSec: 24 });
    expect(view.text()).not.toBe(text);
    expect(voice.player.remove).not.toHaveBeenCalled();
  });

  it('stops its clip when the widget closes', async () => {
    const view = await mount({ ...game, suspicion: 0 }, false, 'speech');
    view.click('speech-read');
    voice.player.remove.mockClear();
    view.close();
    expect(voice.player.remove).toHaveBeenCalled();
  });

  it('follows a volume change while a clip is playing', async () => {
    const view = await mount({ ...game, suspicion: 0 }, false, 'speech');
    view.click('speech-read');
    expect(voice.player.volume).toBeCloseTo(0.3);
    // Panel finding: a slider change mid-clip used to be ignored until the next press.
    act(() => { music.state.setState({ volume: 80 }); });
    expect(voice.player.volume).toBeCloseTo(0.8);
    expect(view.find('speech-read')).not.toBeNull();
  });
});
