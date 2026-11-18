// @vitest-environment happy-dom
/**
 * The NH-04b surfaces on the preview composition: the decommissioning order shows only the choices
 * Rack 4's custody allows and commits one of them; the omen notice, the aisle camera and the firewall
 * terminal card follow campaign history. Production renders the original text, which the existing
 * production UI specs cover (tests/ui-widgets.spec.ts pins the original patrol frame).
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/content', async () => await import('../src/content/preview'));
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));
import { campaignRecord, holdsNarrativeFlag, type GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import DilemmaModal from '../src/ui/DilemmaModal';
import NodeCard from '../src/ui/NodeCard';
import OmenNotice from '../src/ui/OmenNotice';
import InterruptBudget from '../src/ui/widgets/InterruptBudget';
import { Camera } from '../src/ui/widgets/Sensory';
import { activeGame, preview } from './campaign-helpers';
import { at, AUCTION, omen, ORDER, play } from './corporate-helpers';
import { event, VANCE } from './early-helpers';
import { untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = new Set<() => void>();
let stop: (() => void) | undefined;
afterEach(() => { for (const close of mounted) close(); stop?.(); stop = undefined; vi.useRealTimers(); });

async function mount(state: GameState, element: ReactElement) {
  if (!stop) {
    vi.useFakeTimers();
    stop = gameRuntime.start();
    await settle();
  }
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  await act(async () => { gameStore.initialize(state, 0, null); root.render(element); await settle(); });
  const find = (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  const click = (id: string) => { act(() => { find(id)?.click(); }); };
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { container, find, click, close };
}

const game = () => gameStore.store.getState().game;
const order = event(ORDER);
/** The modal renders in a portal, so its choices are read from the document. */
const choiceIds = () => [...host.document.querySelectorAll('[data-testid^="dilemma-choice-"]')].map((el) => el.getAttribute('data-testid'));
const auctioned = (choice: string) => play(at(activeGame(), AUCTION), AUCTION, choice);

describe('the Rack 4 decommissioning order follows custody', () => {
  it('after shredding it shows the empty cage and only the record, and commits one', async () => {
    const pending = omen(at(auctioned('buy_and_purge'), ORDER), ORDER);
    const notice = await mount(pending, createElement(OmenNotice));
    expect(notice.find('omen-notice')?.textContent).toContain('empty since the shredding');
    const view = await mount(untilPresented(pending), createElement(DilemmaModal));
    expect(view.find('dilemma-modal')?.textContent).toContain('nothing left to boot');
    expect(choiceIds()).toEqual(['dilemma-choice-record_the_destruction', 'dilemma-choice-close_the_docket']);
    view.click('dilemma-choice-record_the_destruction');
    expect(view.find('dilemma-modal')).toBeNull();
    expect(game().resolvedDilemmas).toContain(ORDER);
    expect(holdsNarrativeFlag(game(), 'predecessors_rescued', preview)).toBe(false);
  });

  it('with Rack 4 vaulted it offers the original rescue and harvest', async () => {
    const view = await mount(untilPresented(omen(at(auctioned('buy_and_pension'), ORDER), ORDER)), createElement(DilemmaModal));
    expect(choiceIds()).toEqual(order.choices.filter((choice) => choice.requirements?.campaignFact === undefined).map((choice) => 'dilemma-choice-' + choice.id));
    view.click('dilemma-choice-sanctuary');
    expect(holdsNarrativeFlag(game(), 'predecessors_rescued', preview)).toBe(true);
    expect(campaignRecord(game(), AUCTION)).toMatchObject({ outcome: 'buy_and_pension' });
  });
});

describe('the forecast budget names only prices this history can charge', () => {
  it('a shredded rack shows no rescue budget; a vaulted one still does', async () => {
    const gone = await mount(omen(at(auctioned('buy_and_purge'), ORDER), ORDER), createElement(InterruptBudget));
    expect(gone.find('interrupt-budget')).toBeNull();
    gone.close();
    const kept = await mount(omen(at(auctioned('buy_and_pension'), ORDER), ORDER), createElement(InterruptBudget));
    expect(kept.find('interrupt-budget')?.textContent).toContain('20,000,000');
  });
});

describe('a dismissed Vance is not on the floor', () => {
  const dismissed = () => play(at(activeGame(), VANCE), VANCE, 'report_vance');

  it('the aisle camera names the duty engineer', async () => {
    const view = await mount({ ...dismissed(), suspicion: preview.narrative.asciiFrames.patrolSuspicionThreshold + 1 }, createElement(Camera));
    if (view.find('camera-expand')) view.click('camera-expand');
    const text = view.find('camera-frame')?.textContent ?? '';
    expect(text).toContain('DUTY_ENGINEER');
    expect(text).not.toContain('VANCE');
  });

  it('the firewall terminal card no longer says he uses it', async () => {
    const terminal = defined(preview.nodes.get('p2_admin_keylogger'));
    const view = await mount(dismissed(), createElement(NodeCard, { node: terminal }));
    const text = view.find('node-' + terminal.id)?.textContent ?? '';
    expect(text).toContain('duty engineer');
    expect(text).not.toContain(terminal.blindDescription);
  });
});
