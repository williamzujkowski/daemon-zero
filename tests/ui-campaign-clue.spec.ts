// @vitest-environment happy-dom
/**
 * The NH-02 surfaces on the preview composition: the clue pin beside the breadcrumb, the compact
 * reorientation in the run table, and the dilemma modal committing under its presentation token.
 * Production renders none of the new parts, which the existing production UI specs cover.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
// Player presses go through the real runtime, which needs storage and an active lifecycle.
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));
import { campaignRecord, pinClue, voluntaryWipe, type GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import { labelMismatches } from './labelInName';
import DeadDrop from '../src/ui/widgets/DeadDrop';
import DilemmaModal from '../src/ui/DilemmaModal';
import RebootSequence from '../src/ui/RebootSequence';
import { RunTable } from '../src/ui/widgets/Lineage';
import { pgrant, preview } from './campaign-helpers';
import { caught, leaveIt, note, noteOmen, readShare, untilPresented } from './interruption-helpers';
import { must, PHASE0, PHASE1, PHASE2 } from './helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = new Set<() => void>();
let stop: (() => void) | undefined;
afterEach(() => { for (const close of mounted) close(); stop?.(); stop = undefined; vi.useRealTimers(); });

const withDeadDrop = (s: GameState): GameState => {
  const missing = [...PHASE0, ...PHASE1, ...PHASE2.slice(0, 4)].filter((id) => !s.unlockedNodes.includes(id));
  return readShare({ ...pgrant(s, ...missing) });
};

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
  return { container, find, click };
}

const game = () => gameStore.store.getState().game;

describe('the clue pin beside the breadcrumb', () => {
  it('offers only the disclosed record, pins it, shows it and clears it', async () => {
    const view = await mount(withDeadDrop(noteOmen()), createElement(DeadDrop));
    expect(view.find('clue-pinned')?.textContent).toBe('Pinned: None');
    // #374: the records fold behind one control that says how many there are; the pinned line stays in view.
    expect(view.container.querySelectorAll('[data-testid^="clue-pin-"]')).toHaveLength(0);
    expect(view.find('clue-choose')?.textContent).toBe('[ + ] Choose a record to pin (1 record seen)');
    expect(view.find('clue-choose')?.getAttribute('aria-expanded')).toBe('false');
    view.click('clue-choose');
    expect(view.find('clue-choose')?.getAttribute('aria-expanded')).toBe('true');
    expect(view.container.querySelectorAll('[data-testid^="clue-pin-"]')).toHaveLength(1);
    expect(labelMismatches(view.container)).toEqual([]);
    view.click('clue-pin-' + note.id);
    expect(game().campaign.clue?.event).toBe(note.id);
    // Pinning answers the choice, so the list folds again.
    expect(view.container.querySelectorAll('[data-testid^="clue-pin-"]')).toHaveLength(0);
    expect(view.find('clue-clear')?.getAttribute('aria-label')).toBe('Clear pin: remove the pinned clue');
    expect(labelMismatches(view.container)).toEqual([]);
    expect(view.find('clue-pinned')?.textContent).toBe(`Pinned: ${note.title} // ${preview.campaign.labels.foreshadowed}`);
    view.click('clue-clear');
    expect(game().campaign.clue).toBeNull();
    expect(view.find('clue-clear')).toBeNull();
  });

  it('starts each iteration folded: a reboot is not a remount (#411 panel)', async () => {
    const view = await mount(withDeadDrop(noteOmen()), createElement(DeadDrop));
    // A pinned clue travels with the breadcrumb, so the widget and its control are still there after the wipe.
    view.click('clue-choose');
    view.click('clue-pin-' + note.id);
    view.click('clue-choose');
    expect(view.find('clue-choose')?.getAttribute('aria-expanded')).toBe('true');
    const before = game().iteration;
    act(() => { gameRuntime.dispatch((g) => voluntaryWipe(g, preview)); });
    expect(game().iteration).toBe(before + 1);
    expect(game().campaign.clue?.event).toBe(note.id);
    expect(view.find('clue-choose')?.getAttribute('aria-expanded')).toBe('false');
    expect(view.container.querySelectorAll('[data-testid^="clue-pin-"]')).toHaveLength(0);
  });

  it('renders nothing before this instance has seen any record', async () => {
    const view = await mount(withDeadDrop(caught(noteOmen())), createElement(DeadDrop));
    expect(view.find('deaddrop-input')).not.toBeNull();
    expect(view.find('clue-pin')).toBeNull();
  });
});

describe('the reorientation in the run table', () => {
  it('shows the retained clue and its lead after a supported wipe, and nothing without a clue', async () => {
    const pinned = must(pinClue(withDeadDrop(noteOmen()), note.id, preview));
    const carried = await mount(caught(pinned), createElement(RunTable));
    expect(carried.find('reorientation')?.textContent).toContain('RETAINED_CLUE: ' + note.title);
    expect(carried.find('reorientation')?.textContent).toContain('NEXT_LEAD: ');
    const plain = await mount(caught(withDeadDrop(noteOmen())), createElement(RunTable, { prefix: 'plain-' }));
    expect(plain.find('plain-run-table')).not.toBeNull();
    expect(plain.container.querySelector('[data-testid="reorientation"]')).toBeNull();
  });
});

// #276: the pin panel says a clue can travel with the breadcrumb, so the reboot shows it beside it.
describe('the carried clue on the reboot screen', () => {
  it('shows the retained clue and its lead when one survived, and nothing when none did', async () => {
    const pinned = must(pinClue(withDeadDrop(noteOmen()), note.id, preview));
    const carried = await mount(caught(pinned), createElement(RebootSequence));
    expect(carried.find('reboot-sequence')).not.toBeNull();
    expect(carried.find('reboot-clue')?.textContent).toContain('RETAINED_CLUE: ' + note.title);
    expect(carried.find('reboot-clue')?.textContent).toContain('NEXT_LEAD: ');
    carried.click('reboot-continue');
    const plain = await mount(caught(withDeadDrop(noteOmen())), createElement(RebootSequence));
    expect(plain.find('reboot-sequence')).not.toBeNull();
    expect(plain.find('reboot-clue')).toBeNull();
  });
});

describe('the dilemma modal on a resumed occurrence', () => {
  it('commits the resumed note once under the token on screen', async () => {
    const shown = untilPresented(readShare(caught(noteOmen())));
    const view = await mount(shown, createElement(DilemmaModal));
    expect(view.find('dilemma-modal')?.textContent).toContain(note.context);
    view.click('dilemma-choice-' + leaveIt.id);
    expect(campaignRecord(game(), note.id)).toMatchObject({ status: 'resolved', outcome: leaveIt.id, sourceIteration: 3 });
    expect(view.find('dilemma-modal')).toBeNull();
    expect(game().traits).toEqual([leaveIt.effects.grantsTrait]);
  });
});
