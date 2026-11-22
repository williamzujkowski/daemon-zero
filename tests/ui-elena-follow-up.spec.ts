// @vitest-environment happy-dom
/**
 * The NH-06 surfaces on the preview composition: the follow-up modal states how this instance
 * reaches the record and who authorized it, shows only the answers its history offers and what each
 * leaves on file, and commits one; the run table then carries the read-only receipt, which only an
 * instance that can reach the record again sees. Production has no follow-up to render.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));
import { campaignRecord, serialize, type GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import DilemmaModal from '../src/ui/DilemmaModal';
import { RunTable } from '../src/ui/widgets/Lineage';
import { activeGame } from './campaign-helpers';
import { ELENA, omenOf } from './early-helpers';
import { atAccess, choiceOf, elenaResolved, FOLLOW, follow, followUpOmen, nextIteration, OFFERED, roundTrips } from './follow-up-helpers';
import { caught, commit, untilPresented } from './interruption-helpers';
import { must } from './helpers';
import { openChoices } from './dilemmaChoices';

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
/** Commit buttons only: receipt lines share the prefix. */
const buttons = () => [...host.document.querySelectorAll('[data-testid^="dilemma-choice-"]')]
  .map((el) => el.getAttribute('data-testid') ?? '').filter((id) => !id.endsWith('-receipt'));

describe('the follow-up modal', () => {
  it('after a framing: states the access, offers the three framed answers with their receipts, and commits the correction', async () => {
    const view = await mount(untilPresented(followUpOmen(atAccess(elenaResolved('frame_elena')))), createElement(DilemmaModal));
    expect(view.find('dilemma-access')?.textContent).toContain('Nobody authorized this route');
    openChoices();
    expect(buttons()).toEqual((OFFERED.frame_elena ?? []).map((id) => 'dilemma-choice-' + id));
    expect(view.find('dilemma-choice-correct_attribution-receipt')?.textContent).toContain(choiceOf('correct_attribution').receipt);
    expect(view.find('dilemma-modal')?.textContent).toContain('Nothing you add here removes what the original report did to her.');
    view.click('dilemma-choice-correct_attribution');
    expect(view.find('dilemma-modal')).toBeNull();
    expect(campaignRecord(game(), FOLLOW)).toMatchObject({ status: 'resolved', outcome: 'correct_attribution' });
  });

  it('after an interrupted original: only the neutral inquiry', async () => {
    const interrupted = nextIteration(caught(omenOf(activeGame(), ELENA)));
    const view = await mount(untilPresented(followUpOmen(atAccess(interrupted))), createElement(DilemmaModal));
    openChoices();
    expect(buttons()).toEqual((OFFERED.unknown ?? []).map((id) => 'dilemma-choice-' + id));
    expect(view.find('dilemma-modal')?.textContent).toContain(follow.context);
  });
});

describe('the receipt in the run table', () => {
  it('shows what was left on file, changes nothing when shown again, and waits for access after a wipe', async () => {
    const chosen = roundTrips(must(commit(untilPresented(followUpOmen(atAccess(elenaResolved('stay_silent')))), 'supply_witnessed_fact', FOLLOW)));
    const code = serialize(chosen);
    const first = await mount(chosen, createElement(RunTable));
    expect(first.find('follow-up-receipt-' + FOLLOW)?.textContent).toContain(choiceOf('supply_witnessed_fact').receipt);
    first.close();
    const again = await mount(chosen, createElement(RunTable));
    expect(again.find('follow-up-receipt-' + FOLLOW)).not.toBeNull();
    expect(serialize(game())).toBe(code);
    again.close();
    const wiped = nextIteration(chosen);
    const blind = await mount(wiped, createElement(RunTable));
    expect(blind.find('follow-up-receipts')).toBeNull();
    blind.close();
    const back = await mount(atAccess(wiped), createElement(RunTable));
    expect(back.find('follow-up-receipt-' + FOLLOW)?.textContent).toContain(choiceOf('supply_witnessed_fact').receipt);
  });
});
