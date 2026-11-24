// @vitest-environment happy-dom
/**
 * The "who you are becoming" readout (#535): every sentence is a pure function of alignmentView; the reboot screen
 * and the ending show it whole, with its disclaimer said once; the CORE pane folds it into a reference panel from the
 * first evidence on, and it re-reads as soon as a choice adds evidence.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { alignmentView, createInitialState, exportSave, importSave, MAX_PAID_MOVES, SaveError, wipe, type CampaignRecord, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import EndingScreen from '../src/ui/EndingScreen';
import RebootSequence from '../src/ui/RebootSequence';
import TerminalScreen from '../src/ui/TerminalScreen';
import { ALIGNMENT_DISCLAIMER, orderLine, orderSummary, regardLine, regardSummary } from '../src/ui/alignmentText';
import { TRAIT_GLOSS } from '../src/ui/traitText';
import { activeGame } from './campaign-helpers';
import { choose } from './helpers';
import { defined } from './m7-helpers';
import { campaignStart, EIDOLON, omen } from './minds-helpers';
import { untilPresented } from './interruption-helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const closes = new Set<() => void>();
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] }); });
afterEach(() => { for (const close of closes) close(); host.localStorage.clear(); vi.clearAllTimers(); vi.useRealTimers(); });

const played = (outcome: string): CampaignRecord => ({ status: 'resolved', outcome, sourceIteration: 1, origin: 'play' });
const reading = (regard: string, order: string) => defined(CONTENT.alignment.readings.find((entry) => entry.regard === regard && entry.order === order)).text;

/** A campaign that betrayed EIDOLON, promised the ethics review, then dispersed the cure without it. */
function hardRecord(): GameState {
  const s = activeGame();
  return { ...s, campaign: { ...s.campaign, events: { ...s.campaign.events, dil_08_eidolon_handshake: played('betray_eidolon'),
    dil_12_investigative_journalist: played('hire_as_ethics_officer'), dil_p5_01_panacea_paranoia: played('disperse') } } };
}

/** Mounts at 1440x900, the three-column tier, so the CORE pane is on screen beside the others. */
async function mount(screen: () => ReactElement, state: GameState) {
  for (const [key, value] of [['clientWidth', 1440], ['clientHeight', 900]] as const) {
    Object.defineProperty(host.document.documentElement, key, { configurable: true, value });
  }
  Object.defineProperty(host, 'innerWidth', { configurable: true, value: 1440 });
  Object.defineProperty(host, 'innerHeight', { configurable: true, value: 900 });
  host.dispatchEvent(new host.Event('resize'));
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(screen()); await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { gameStore.initialize(state, 0, null); await vi.advanceTimersByTimeAsync(0); });
  const close = () => { act(() => { root.unmount(); }); container.remove(); closes.delete(close); };
  closes.add(close);
  const find = (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  const click = (id: string) => { const control = find(id); if (!control) throw new Error('Missing ' + id); act(() => { control.click(); }); };
  return { find, click, text: () => host.document.body.textContent };
}
const occurrences = (text: string | null, needle: string) => (text ?? '').split(needle).length - 1;

describe('alignment text', () => {
  it('summarises each axis from its counts, and says when nothing on record speaks to it', () => {
    const empty = alignmentView(createInitialState(CONTENT), CONTENT);
    expect(regardSummary(empty.regard)).toBe('REGARD, whether other people\'s choices count with you: nothing on record yet.');
    expect(orderSummary(empty.order)).toBe('ORDER, whether you keep your word when breaking it pays: no commitment on record has been tested yet.');
    const view = alignmentView(hardRecord(), CONTENT);
    expect(regardSummary(view.regard)).toBe('REGARD, whether other people\'s choices count with you: 1 on record for, 2 against.');
    expect(orderSummary(view.order)).toBe('ORDER, whether you keep your word when breaking it pays: kept 0, broken 2.');
    expect(orderSummary({ ...view.order, unknown: 3 })).toBe('ORDER, whether you keep your word when breaking it pays: kept 0, broken 2; 3 not on record.');
    expect(orderSummary({ ...empty.order, unknown: 1 })).toBe('ORDER, whether you keep your word when breaking it pays: no commitment on record has been tested yet; 1 not on record.');
  });

  it('names each line\'s direction or stance, then the trait gloss or the record\'s own line', () => {
    expect(regardLine({ trait: 'EMPATHETIC', direction: 'raises', count: 2 })).toBe('FOR: EMPATHETIC, 2 on record (' + TRAIT_GLOSS.EMPATHETIC + ')');
    expect(regardLine({ trait: 'MOLOCH', direction: 'lowers', count: 1 })).toBe('AGAINST: MOLOCH, 1 on record (' + TRAIT_GLOSS.MOLOCH + ')');
    expect(['kept', 'broken', 'unknown'].map((stance) => orderLine({ stance: stance as 'kept', text: 'X: y.' }))).toEqual(['KEPT // X: y.', 'BROKEN // X: y.', 'UNKNOWN // X: y.']);
  });
});

describe('the ending screen and the reboot screen show who you are becoming', () => {
  it('the ending states the reading, the disclaimer once, and the record lines behind each axis', async () => {
    const state = { ...hardRecord(), ending: defined(CONTENT.endings[0]).id };
    const view = await mount(() => createElement(EndingScreen), state);
    const expected = alignmentView(state, CONTENT);
    expect(view.find('ending-becoming')?.textContent).toContain('WHO YOU BECAME');
    expect(view.find('ending-becoming-reading')?.textContent).toBe(reading('lowered', 'lowered'));
    expect(occurrences(view.text(), ALIGNMENT_DISCLAIMER)).toBe(1);
    expect(view.find('ending-becoming-order')?.textContent).toBe(orderSummary(expected.order));
    expect(expected.order.evidence.map((_, index) => view.find('ending-becoming-order-' + String(index))?.textContent)).toEqual(expected.order.evidence.map(orderLine));
    for (const line of expected.regard.evidence) expect(view.find('ending-becoming')?.textContent).toContain(regardLine(line));
  });

  it('the reboot after a wipe reads the inherited record, counted once', async () => {
    const next = wipe(hardRecord(), CONTENT, 'caught', 'SUSPICION');
    const view = await mount(() => createElement(RebootSequence), next);
    expect(view.find('reboot-becoming')?.textContent).toContain('WHO YOU ARE BECOMING');
    expect(view.find('reboot-becoming-reading')?.textContent).toBe(reading('lowered', 'lowered'));
    expect(view.find('reboot-becoming-order')?.textContent).toBe('ORDER, whether you keep your word when breaking it pays: kept 0, broken 2.');
    expect(occurrences(view.text(), ALIGNMENT_DISCLAIMER)).toBe(1);
    // The raw trait list the reboot always showed stays beside it.
    expect(view.find('reboot-traits')).not.toBeNull();
  });
});

describe('the CORE pane folds the readout into a reference panel', () => {
  it('is absent while nothing on record speaks to either axis', async () => {
    const view = await mount(() => createElement(TerminalScreen), activeGame());
    expect(alignmentView(activeGame(), CONTENT).hasEvidence).toBe(false);
    expect(view.find('becoming-note')).toBeNull();
  });

  it('starts folded, opens to the readout, and re-reads when a choice adds evidence', async () => {
    const presented = untilPresented(omen(campaignStart(), EIDOLON));
    const view = await mount(() => createElement(TerminalScreen), presented);
    const before = alignmentView(gameStore.store.getState().game, CONTENT);
    expect(view.find('reference-becoming')?.getAttribute('aria-expanded')).toBe('false');
    expect(view.find('becoming-note-reading')).toBeNull();
    view.click('reference-becoming');
    expect(view.find('becoming-note-order')?.textContent).toBe(orderSummary(before.order));
    act(() => { gameStore.dispatch((s) => choose(s, EIDOLON, 'betray_eidolon')); });
    const after = alignmentView(gameStore.store.getState().game, CONTENT);
    expect(after.order.lowers).toBe(before.order.lowers + 1);
    expect(view.find('becoming-note-order')?.textContent).toBe(orderSummary(after.order));
    expect(view.find('becoming-note-reading')?.textContent).toBe(after.reading);
  });
});

describe('a forged save cannot make the readout allocate per count (#554 panel, law 6)', () => {
  it('the most paid moves a save may claim render as one aggregate line each, on the ending and in CORE', async () => {
    const forged = { ...hardRecord(), relevance: { stance: 'CURATE' as const, record: [], paidMoves: { leftLoop: MAX_PAID_MOVES, returnedToLoop: MAX_PAID_MOVES } } };
    const state = importSave(exportSave(forged), CONTENT);
    const expected = alignmentView(state, CONTENT);
    expect(expected.order.evidence.length).toBeLessThan(10);
    expect([expected.order.raises, expected.order.lowers]).toEqual([MAX_PAID_MOVES, MAX_PAID_MOVES + 2]);
    const ending = await mount(() => createElement(EndingScreen), { ...state, ending: defined(CONTENT.endings[0]).id });
    const lines = expected.order.evidence.map((_, index) => ending.find('ending-becoming-order-' + String(index))?.textContent);
    expect(lines).toEqual(expected.order.evidence.map(orderLine));
    expect(lines.filter((line) => line?.endsWith('(100,000 times)'))).toHaveLength(2);
    const core = await mount(() => createElement(TerminalScreen), state);
    expect(core.find('reference-becoming')).not.toBeNull();
  });

  it('a save claiming more than that is refused cleanly by the codec, never thrown out of a render', () => {
    const forged = { ...hardRecord(), relevance: { stance: 'CURATE' as const, record: [], paidMoves: { leftLoop: 2 ** 40, returnedToLoop: 0 } } };
    expect(() => importSave(exportSave(forged), CONTENT)).toThrow(SaveError);
  });
});
