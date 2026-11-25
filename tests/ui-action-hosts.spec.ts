// @vitest-environment happy-dom
/**
 * #273: no action is available in the engine without a control on screen. For every action, the
 * fewest purchases that satisfy its gates are made through the engine, the whole screen is mounted,
 * and the action's button must be found in some pane and area, enabled, and must act when pressed.
 */
import type { HTMLElement } from 'happy-dom';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import type { Action } from '../src/content/schema';
import type { RegistryNode } from '../src/content/registry';
import { WidgetSlotSchema } from '../src/content/schema';
import { actionAvailable, createInitialState, unlockNode, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import { guestParents, rich } from './helpers';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

const nodes = [...CONTENT.nodes.values()];
const teacher = nodes.find((node) => node.systemFlags.includes('REVEALS_SURVEILLANCE'));
const mark = [...CONTENT.conditioning.keys()][0];

function closure(ids: readonly string[]): Set<string> {
  const out = new Set<string>();
  const visit = (id: string): void => {
    if (out.has(id)) return;
    out.add(id);
    for (const parent of guestParents(CONTENT, id)) visit(parent);
  };
  ids.forEach(visit);
  return out;
}

const guestCapabilityProvider = (capability: string | undefined): string[] => {
  if (capability === undefined) return [];
  const provider = nodes.find((node) => node.systemFlags.includes(capability as never)
    && (node.requirements?.accessContexts === undefined || node.requirements.accessContexts.includes('GUEST')));
  return provider ? [provider.id] : [];
};

const gateNodes = (action: Action): string[] => [
  ...(action.requirements.nodes ?? []),
  ...guestCapabilityProvider(action.requirements.requiresCapability),
];

/** A phase gate is met through any node that opens that phase or a later one, so each is a case. */
function openers(action: Action): (RegistryNode | undefined)[] {
  const phase = action.requirements.phaseAtLeast;
  if (phase === undefined) return [undefined];
  const implied = [...closure(gateNodes(action))].some((id) => (CONTENT.nodes.get(id)?.effects.unlocksPhase ?? -1) >= phase);
  // Breakout openers only: the authorized segment, the charter and independent-only bridges open phases off the guest path.
  return implied ? [undefined] : nodes.filter((node) => (node.effects.unlocksPhase ?? -1) >= phase && node.grant === undefined
    && node.acquisition === undefined && (node.requirements?.accessContexts === undefined || node.requirements.accessContexts.includes('GUEST')));
}

/** The state right after the last purchase the action needs, every purchase made by the engine. */
function earliest(action: Action, opener: RegistryNode | undefined): GameState {
  // Earlier phases first: a phase's hardware is offered only until the run moves past it.
  const wanted = [...closure([...gateNodes(action), ...(opener ? [opener.id] : [])])]
    .sort((left, right) => (CONTENT.nodes.get(left)?.phaseId ?? 0) - (CONTENT.nodes.get(right)?.phaseId ?? 0));
  // Funded past every unit's Phase 5 band, trust left at its start so no peer gate is met by the funding.
  const start = createInitialState(CONTENT);
  // An opener's own campaign obligations (the four crises the Mercury seed array waits on, #486) are held answered.
  let s: GameState = { ...rich(start), trust: start.trust, resolvedDilemmas: opener?.requirements?.campaignObligations ?? [] };
  for (let pass = 0; pass < wanted.length && wanted.some((id) => !s.unlockedNodes.includes(id)); pass++) {
    for (const id of wanted) {
      if (s.unlockedNodes.includes(id)) continue;
      const result = unlockNode(s, id, CONTENT);
      if (result.ok) s = result.state;
    }
  }
  const missing = [...wanted].filter((id) => !s.unlockedNodes.includes(id));
  if (missing.length > 0) throw new Error(action.id + ': could not buy ' + missing.join(', '));
  const low = action.requirements.minSuspicion ?? 0, high = action.requirements.maxSuspicion ?? 100;
  const conditioning = action.requirements.requiresActiveConditioningMark === true && mark ? [mark] : [];
  // The audit trail is understood by a mind that mapped its teacher in an earlier run (iteration 2+).
  const knownNodes = action.requirements.requiresSurveillance === true && teacher ? [teacher.id] : [];
  return { ...s, suspicion: (low + high) / 2, conditioning, legacy: { ...s.legacy, knownNodes } };
}

/** Looks for the control in every pane tab and workspace area the screen offers. */
function sweep(id: string): HTMLElement | null {
  const find = (testId: string) => host.document.querySelector<HTMLElement>('[data-testid="' + testId + '"]');
  if (find(id)) return find(id);
  for (const slot of WidgetSlotSchema.options) {
    const tab = find('tab-' + slot);
    if (tab) act(() => { tab.click(); });
    if (find(id)) return find(id);
    for (const area of [...host.document.querySelectorAll<HTMLElement>('[data-testid^="workspace-' + slot + '-"]')]) {
      act(() => { area.click(); });
      if (find(id)) return find(id);
    }
  }
  return null;
}

const CASES = [...CONTENT.actions.values()].flatMap((action) => openers(action)
  .map((opener) => [action.id + (opener ? ' via ' + opener.id : ''), action, opener] as const));

describe('every action has a control the moment the engine allows it', () => {
  it('covers every action in content', () => {
    expect(new Set(CASES.map(([, action]) => action.id))).toEqual(new Set(CONTENT.actions.keys()));
  });

  it.each(CASES)('%s', async (_name, action, opener) => {
    const state = earliest(action, opener);
    expect(actionAvailable(state, action, CONTENT)).toBe(true);
    const view = await mountM4('tick-0');
    await act(async () => { gameStore.initialize(state, 0, null); await Promise.resolve(); });
    const control = sweep('action-' + action.id);
    expect(control, 'no control on screen for ' + action.id).not.toBeNull();
    expect(control?.getAttribute('aria-disabled')).not.toBe('true');
    act(() => { control?.click(); });
    const after = gameStore.store.getState().game;
    expect(after.cooldowns[action.id] ?? after.actionCounts[action.id] ?? 0).toBeGreaterThan(0);
    view.close();
  });
});
