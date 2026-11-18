// @vitest-environment happy-dom
/**
 * NH-05 surfaces on the preview composition: the final protocol's hint names the decision that
 * completes each obligation now (the original, or its recovery review once the original closed
 * unobserved), and the review modal commits the free honest handoff. Production keeps its hint
 * text, since legacy rules read obligations as the current run's resolved dilemmas.
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
import { obligationReceipt, type GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import DilemmaModal from '../src/ui/DilemmaModal';
import RequirementHint from '../src/ui/RequirementHint';
import { activeGame, preview } from './campaign-helpers';
import { event } from './early-helpers';
import { caught, ticks, untilPresented } from './interruption-helpers';
import { exactReload, omen, own } from './minds-helpers';
import { ATMOSPHERE, ATMOSPHERE_REVIEW, CEILING, finalNode, OBLIGATIONS } from './obligation-helpers';

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
  const click = (id: string) => { act(() => { host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]')?.click(); }); };
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { container, click, close };
}

const FINAL = finalNode();
const hint = () => createElement(RequirementHint, { requirements: FINAL.requirements });
const game = () => gameStore.store.getState().game;

describe('the final protocol names what completes each obligation now', () => {
  it('lists the four originals while all are open', async () => {
    const view = await mount(exactReload(own(activeGame(), ...FINAL.prerequisites)), hint());
    expect(view.container.textContent).toBe(OBLIGATIONS.map((id) => 'Resolve ' + event(id).title).join('\n'));
  });

  it('names the recovery review once the original closed unobserved, and the modal commits its honest handoff', async () => {
    const lost = exactReload(caught(ticks(omen(activeGame(), ATMOSPHERE, [CEILING]), 5)));
    const view = await mount(exactReload(own(lost, ...FINAL.prerequisites)), hint());
    // The blockade and the order were completed by the setup; the closed crisis is answered through its review.
    expect(view.container.textContent).toBe(['Resolve ' + event(ATMOSPHERE_REVIEW).title, 'Resolve ' + event(CEILING).title].join('\n'));
    view.close();
    const modal = await mount(untilPresented(omen(lost, ATMOSPHERE_REVIEW, [CEILING])), createElement(DilemmaModal));
    modal.click('dilemma-choice-hand_to_health_authorities');
    expect(obligationReceipt(game(), ATMOSPHERE, preview)?.via).toBe('review');
  });
});
