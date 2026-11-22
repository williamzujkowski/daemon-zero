// @vitest-environment happy-dom
/**
 * The feed widget and the autoplay policy together (#462): a voiced line plays once when first shown,
 * holds the rotation while it talks, offers STOP, and never plays again on its own. The platform player
 * is mocked at expo-audio, so what is asserted is which clip the game asks for and when.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AccessibilityInfo } from 'react-native';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Status = { playing?: boolean; didJustFinish?: boolean; error?: string | null };
const voice = vi.hoisted(() => {
  const listeners: ((status: { playing?: boolean; didJustFinish?: boolean }) => void)[] = [];
  return { listeners, player: { volume: 1, play: vi.fn(), remove: vi.fn(), release: vi.fn(),
    addListener: vi.fn((_event: string, listener: (status: { playing?: boolean }) => void) => { listeners.push(listener); return { remove: vi.fn() }; }) },
  create: vi.fn(), mode: vi.fn(() => Promise.resolve()) };
});
vi.mock('expo-audio', () => ({ createAudioPlayer: voice.create, setAudioModeAsync: voice.mode }));
import { CONTENT } from '../src/content';
import { eligibleAmbientSpeech, importSave, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import { music } from '../src/app/musicSession';
import { overlayPresence } from '../src/app/overlayPresence';
import { voiceSources } from '../src/app/voiceSources';
import { voiceAutoplay } from '../src/app/voiceSession';
import Speech from '../src/ui/widgets/Speech';
import { SafeOverlay } from '../src/ui/safeArea';
import { makePhase1Fixtures } from '../scripts/make-fixtures';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const decoder = 'INSPECTION_COUNTDOWN_TIMER';
const OPEN = { speechEnabled: true, speechVolume: 30, running: true, foreground: true, overlays: 0, unlocked: true };
let game: GameState;
let reduced = false;
const mounted = new Set<() => void>();

beforeAll(() => {
  game = { ...importSave(makePhase1Fixtures()['phase-1-widgets'] ?? '', CONTENT), suspicion: 0 };
  voiceAutoplay.load([]);
});
beforeEach(() => {
  reduced = false;
  voice.create.mockReturnValue(voice.player);
  voice.create.mockClear(); voice.player.remove.mockClear(); voice.listeners.length = 0;
  music.state.setState({ enabled: false, volume: 30, speechEnabled: true, speechVolume: 30 });
  vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => Promise.resolve(reduced));
  vi.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(() => ({ remove: () => undefined }));
});
afterEach(() => {
  for (const close of mounted) close();
  voiceAutoplay.update({ ...OPEN, unlocked: false });
  vi.restoreAllMocks();
});

async function mount(state: GameState) {
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  await act(async () => {
    gameStore.initialize(state, 0, null);
    root.render(createElement(Speech, { decoderId: decoder }));
    await Promise.resolve();
  });
  const find = (id: string) => container.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { find, close, text: () => find('decoded-speech')?.textContent ?? '', click: (id: string) => { act(() => { find(id)?.click(); }); } };
}
const lineOf = (text: string) => CONTENT.narrative.ambientChatter.find((line) => line.text === text)?.id ?? '';
/** The newest clip's player reports a status, as expo-audio would. */
const report = (status: Status) => { act(() => { voice.listeners.at(-1)?.({ didJustFinish: false, ...status }); }); };
const asked = () => voice.create.mock.calls.map((call) => call[0] as unknown);
const patch = (values: Partial<GameState>) => { act(() => { gameStore.dispatch((state) => ({ ok: true, state: { ...state, ...values } })); }); };

describe('voice autoplay in the feed', () => {
  it('plays the shown line once, holds it while it talks, and never replays it on rotation', async () => {
    const view = await mount({ ...game, simTimeSec: 0 });
    const first = lineOf(view.text());
    expect(asked(), 'nothing before the gate opens').toEqual([]);
    act(() => { voiceAutoplay.update(OPEN); });
    expect(asked()).toEqual([voiceSources[first]]);
    report({ playing: true });
    expect(voiceAutoplay.hasHeard(first)).toBe(true);
    // The control is STOP while its own line talks, and the rotation waits for the voice.
    expect(view.find('speech-stop')?.getAttribute('aria-label')).toBe('[ ■ STOP ] Stop reading this transmission aloud');
    expect(view.find('speech-read')).toBeNull();
    patch({ simTimeSec: 8 });
    expect(lineOf(view.text())).toBe(first);
    expect(view.find('speech-follow-live'), 'an autoplay hold is not a player hold').toBeNull();
    // The clip ends: the hold lets go, the feed returns to live, and the next unheard line plays.
    report({ didJustFinish: true });
    const second = lineOf(view.text());
    expect(second).not.toBe(first);
    expect(asked()).toEqual([voiceSources[first], voiceSources[second]]);
    report({ playing: true }); report({ didJustFinish: true });
    // Back round to the first line: it is shown, and not played again.
    const lines = eligibleAmbientSpeech(gameStore.store.getState().game, CONTENT, decoder);
    patch({ simTimeSec: 8 * lines.length });
    expect(lineOf(view.text())).toBe(first);
    expect(asked()).toHaveLength(2);
    expect(view.find('speech-read')).not.toBeNull();
  });

  it('STOP silences an autoplayed line, READ replays it on demand, and neither starts it again by itself', async () => {
    reduced = true;
    const view = await mount({ ...game, simTimeSec: 0 });
    // The previous case heard the first two lines; the third has never been heard.
    view.click('speech-next'); view.click('speech-next');
    const line = lineOf(view.text());
    expect(voiceAutoplay.hasHeard(line)).toBe(false);
    act(() => { voiceAutoplay.update(OPEN); });
    expect(asked()).toEqual([voiceSources[line]]);
    report({ playing: true });
    voice.player.remove.mockClear();
    view.click('speech-stop');
    expect(voice.player.remove).toHaveBeenCalled();
    expect(view.find('speech-read')).not.toBeNull();
    view.click('speech-read');
    expect(asked()).toEqual([voiceSources[line], voiceSources[line]]);
    report({ didJustFinish: true });
    // Round the whole feed and back with the gate shut (lines passed by leave the queue unheard),
    // then open it on this line: it was heard, so nothing starts.
    act(() => { voiceAutoplay.update({ unlocked: false }); });
    const count = eligibleAmbientSpeech(gameStore.store.getState().game, CONTENT, decoder).length;
    for (let step = 0; step < count; step++) view.click('speech-next');
    expect(lineOf(view.text())).toBe(line);
    act(() => { voiceAutoplay.update({ unlocked: true }); });
    expect(asked(), 'shown again: nothing new').toHaveLength(2);
  });

  it('a line read before the gate opens is heard, and does not autoplay afterwards', async () => {
    reduced = true;
    const view = await mount({ ...game, simTimeSec: 0 });
    // Step to a line no earlier case reached.
    for (let step = 0; step < 4; step++) view.click('speech-next');
    const line = lineOf(view.text());
    view.click('speech-read');
    expect(voiceAutoplay.hasHeard(line)).toBe(true);
    report({ didJustFinish: true });
    voice.create.mockClear();
    act(() => { voiceAutoplay.update(OPEN); });
    expect(asked()).toEqual([]);
  });

  it('waits while a modal is open: every modal backdrop counts itself', () => {
    const container = host.document.createElement('div'), root = createRoot(container);
    act(() => { root.render(createElement(SafeOverlay, { padding: 0, children: null })); });
    expect(overlayPresence.getState().open).toBe(1);
    act(() => { root.unmount(); });
    expect(overlayPresence.getState().open).toBe(0);
  });
});
