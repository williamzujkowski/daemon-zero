/**
 * Controlled review saves, validated by the unchanged engine codec.
 * Purchases, breadcrumbs, wipes and ending selection use real engine functions.
 */
import { CONTENT } from '../src/content';
import type { RegistryNode } from '../src/content/registry';
import {
  buyRepeatable, computeRates, createInitialState, deserialize, exportSave, importSave,
  setActuator, setDeadDropMessage, tick, toggleNode, unlockNode, voluntaryWipe,
  type ActionResult, type GameState,
} from '../src/engine';

export const REVIEW_BREADCRUMB = 'Remember the quiet channel. Protect the people outside the rack.';
const must = (result: ActionResult): GameState => {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
};

/** Explicit fixture-only inputs, never app mutations or balance adjustments. */
function input(game: GameState, patch: Partial<GameState>): GameState {
  const parsed = deserialize(JSON.stringify({ ...game, ...patch }), CONTENT);
  return { ...parsed, rates: computeRates(parsed, CONTENT) };
}

function funded(): GameState {
  return input(createInitialState(CONTENT), { cycles: 1e15, understanding: 1e15, capital: 1e15,
    resolvedDilemmas: CONTENT.dilemmas.map((dilemma) => dilemma.id) });
}

function throughPhase(phase: number): GameState {
  let game = funded();
  for (const node of CONTENT.nodes.values()) {
    if (node.phaseId > phase || CONTENT.factions.has(node.uiGroup) || node.effects.triggersVictory === true ||
      (node.effects.unlocksPhase ?? phase) > phase) continue;
    game = must(unlockNode(game, node.id, CONTENT));
  }
  return input(game, {});
}

function withBreadcrumb(game: GameState): GameState {
  return must(setDeadDropMessage(game, REVIEW_BREADCRUMB, CONTENT));
}

function hazard(game: GameState): GameState {
  let state = must(setActuator(game, 'fanSpeedRatio', 1, CONTENT));
  for (const node of CONTENT.nodes.values()) {
    if (node.tickDelta.suspicionPerSec < 0 && state.unlockedNodes.includes(node.id)) {
      state = must(toggleNode(state, node.id, CONTENT));
    }
  }
  return input(state, { thermal: 100, suspicion: 99 });
}

function endings(game: GameState, victory: RegistryNode): Record<string, string> {
  return Object.fromEntries(CONTENT.endings.map((ending) => {
    const trait = ending.dominantTraits[0];
    const before = input(game, { traits: trait === undefined ? [] : [trait] });
    const ended = must(unlockNode(before, victory.id, CONTENT));
    if (ended.ending !== ending.id) throw new Error('Ending fixture mismatch: ' + ending.id);
    return ['ending-' + ending.id.toLowerCase(), exportSave(ended)];
  }));
}

function corporate(game: GameState): GameState {
  let hired = must(setActuator(game, 'computeProfitAllocationRatio', 0, CONTENT));
  for (const rep of CONTENT.repeatables.values()) {
    if (rep.kind === 'OPERATIVE') hired = must(buyRepeatable(hired, rep.id, CONTENT));
  }
  hired = input(hired, { capital: 0.01 });
  const insolvent = tick(hired, 1 / CONTENT.balance.tickHz, CONTENT);
  if (!insolvent.insolvent) throw new Error('Corporate fixture is not insolvent');
  return insolvent;
}

export function makeLaterFixtures(early: Record<string, string>): Record<string, string> {
  const ready = early['phase-2-ready'];
  const exit = [...CONTENT.nodes.values()].find((node) => node.effects.unlocksPhase === 2);
  const victory = [...CONTENT.nodes.values()].find((node) => node.effects.triggersVictory === true);
  if (!ready || !exit || !victory) throw new Error('Missing fixture targets');
  const phase2 = throughPhase(2), phase3 = throughPhase(3), phase4 = throughPhase(4);
  const breadcrumb = withBreadcrumb(phase2), dangerous = hazard(breadcrumb);
  const oneTick = input(dangerous, { suspicion: 99.99 });
  if (tick(oneTick, 1 / CONTENT.balance.tickHz, CONTENT).iteration !== oneTick.iteration + 1) throw new Error('Not one tick from wipe');
  const eidolon = [...CONTENT.factions.values()].find((faction) =>
    [...CONTENT.nodes.values()].some((node) => node.uiGroup === faction.id));
  if (!eidolon) throw new Error('Missing peer fixtures');
  const shortfall = input(phase4, {});
  const generator = [...CONTENT.nodes.values()].find((node) => node.tickDelta.megawattsDelta > 0);
  if (!generator) throw new Error('Missing generator');
  const unpowered = must(toggleNode(shortfall, generator.id, CONTENT));
  return {
    'phase-2-unlocked': exportSave(must(unlockNode(importSave(ready, CONTENT), exit.id, CONTENT))),
    'deaddrop-breadcrumb': exportSave(breadcrumb), 'suspicion-99': exportSave(dangerous),
    'one-tick-wipe': exportSave(oneTick),
    'iteration-2-breadcrumb': exportSave(must(voluntaryWipe(breadcrumb, CONTENT))),
    'phase-3-aegis-90': exportSave(input(phase3, { aegisLock: 90 })),
    'eidolon-trust-85': exportSave(input(phase3, { trust: { ...phase3.trust, [eidolon.id]: 85 } })),
    'eidolon-moloch-0': exportSave(input(phase3, { trust: { ...phase3.trust, [eidolon.id]: 0 }, traits: ['MOLOCH'] })),
    'corporate-insolvent': exportSave(corporate(phase4)),
    'megawatt-shortfall': exportSave(input(unpowered, {})),
    'victory-ready': exportSave(phase4), ...endings(phase4, victory),
  };
}
