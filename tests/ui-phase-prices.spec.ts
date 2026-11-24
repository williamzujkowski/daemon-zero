// @vitest-environment happy-dom
/**
 * Prices carried into a later phase (#494) are what the cards say: the action card and the dilemma's choice row show the
 * price the engine charges in the current phase, never the listed one, so the text a player reads is the debit.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { actionCost, choiceCost, costText, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import { ActionCard } from '../src/ui/ActionsPanel';
import DilemmaModal from '../src/ui/DilemmaModal';
import { grant, onHost, PHASE1, PHASE2, PHASE3, withoutDilemmas } from './helpers';
import { defined } from './m7-helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = new Set<() => void>();
afterEach(() => { for (const close of mounted) close(); });

async function mount(state: GameState, element: ReactElement) {
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  await act(async () => { gameStore.initialize(state, 0, null); root.render(element); await Promise.resolve(); });
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
}

const phase4 = (): GameState => withoutDilemmas(grant(onHost(), ...PHASE1, ...PHASE2, ...PHASE3));

describe('carried prices on the cards (#494)', () => {
  it('shows a Phase 2 action used in Phase 4 at the price it will be charged', async () => {
    const scrub = defined(CONTENT.actions.get('act_p2_scrub_audit_logs'));
    const state = phase4();
    const find = await mount(state, createElement(ActionCard, { action: scrub }));
    const carried = actionCost(state, scrub, CONTENT);
    expect(carried.cycles).toBeGreaterThan(scrub.cost.cycles);
    expect(find('action-cost-' + scrub.id)?.textContent).toBe('Cost: ' + costText(carried));
  });

  it('shows a Phase 2 dilemma answered in Phase 4 at the price it will be charged', async () => {
    const dilemma = defined(CONTENT.dilemmas.find((entry) => entry.id === 'dil_04_admin_vance_secret'));
    const choice = defined(dilemma.choices.find((entry) => entry.id === 'parasite_miner'));
    const base = phase4();
    const state: GameState = { ...base, activeDilemmaId: dilemma.id, resolvedDilemmas: base.resolvedDilemmas.filter((id) => id !== dilemma.id) };
    const find = await mount(state, createElement(DilemmaModal));
    const label = find('dilemma-card-' + choice.id + '-toggle')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Cost: ' + costText(choiceCost(state, dilemma, choice, CONTENT)));
    expect(label).not.toContain('Cost: ' + costText(choice.cost));
  });
});
