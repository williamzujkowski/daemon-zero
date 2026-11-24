/**
 * Controlled review saves, validated by the unchanged engine codec.
 * Purchases, breadcrumbs, wipes and ending selection use real engine functions.
 */
import { CONTENT } from '../src/content';
import type { RegistryNode } from '../src/content/registry';
import {
  buyRepeatable, chooseEnding, computeRates, createInitialState, deserialize, exportSave, importSave,
  setActuator, setDeadDropMessage, tick, toggleNode, unlockNode, voluntaryWipe,
  type ActionResult, type GameState,
} from '../src/engine';
import { ORIGINAL, QUIET_DILEMMA_IDS, ORIGINAL_NODES } from './original-content';

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
  return input(createInitialState(CONTENT), { cycles: 1e30, understanding: 1e15, capital: 1e18,
    resolvedDilemmas: QUIET_DILEMMA_IDS });
}


function throughPhase(phase: number): GameState {
  let game = funded();
  for (const node of ORIGINAL_NODES) {
    if (node.phaseId > phase || CONTENT.factions.has(node.uiGroup) || node.effects.triggersVictory === true ||
      node.requirements?.minIteration !== undefined ||
      // A milestone's node (the fusion pilot's Q>1 shot, #482) waits on an action the instant build does not take.
      node.requirements?.requiredNarrativeFlag !== undefined ||
      (node.effects.unlocksPhase ?? phase) > phase) continue;
    const before = game.suspicion;
    game = must(unlockNode(game, node.id, CONTENT));
    // Hardware taken after the guest leaves a one-off trace (#488) that play spreads over hours and lets decay before the
    // next seizure; the instant build would carry every one at once, so it keeps the suspicion it had. The same holds
    // for a filing's or a permit's one-off trace (#482: the interconnection request, the air permit, the turbine slot).
    if (node.phaseId > 0 && (!node.suspendable || (node.effects.suspicionOnUnlock ?? 0) > 0)) game = input(game, { suspicion: before });
  }
  // Every quiet dilemma is held resolved while the nodes are bought, so none interrupts the build; makeFixtures
  // then keeps only those the save could have met (scripts/reachable-fixture.ts, #382).
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

function endings(game: GameState, legacy: GameState, victory: RegistryNode): Record<string, string> {
  // The original endings: the route's own endings (#232) are reached and reviewed by tests/e2e/cooperative-ending.e2e.ts.
  return Object.fromEntries(CONTENT.endings.filter((ending) => !ending.forcedOnly && ORIGINAL.endings.some((entry) => entry.id === ending.id)).map((ending) => {
    const trait = ending.dominantTraits[0];
    const flags = ending.requirements?.requiredNarrativeFlag;
    const before = input(ending.variantOf === undefined ? legacy : game, {
      traits: trait === undefined ? [] : [trait], narrativeFlags: flags === undefined ? [] : [flags],
    });
    // Retired Phase 4 endings remain loadable historical states; new variants use the actual final purchase.
    // A campaign-history variant (NH-05) needs campaign rules, which production never runs: its review
    // state is labelled as an ended save that stores the ending, the way a preview run would leave it.
    const campaignOnly = ending.requirements?.campaignFact !== undefined;
    const ended = ending.variantOf === undefined ? input(before, { ending: chooseEnding(before, CONTENT).id })
      : campaignOnly ? input(before, { ending: ending.id }) : must(unlockNode(before, victory.id, CONTENT));
    if (ended.ending !== ending.id) throw new Error('Ending fixture mismatch: ' + ending.id);
    return ['ending-' + ending.id.toLowerCase(), exportSave(ended)];
  }));
}

/** The node that forces `ending`, from content. */
function forcing(ending: string): RegistryNode {
  const node = ORIGINAL_NODES.find((entry) => entry.effects.forcesEnding === ending);
  if (!node) throw new Error('Missing protocol for ' + ending);
  return node;
}

/**
 * The Phase 6 Swarm (#486): a state just past the seed array with the federation built and both crises still to come,
 * and each swarm ending reached through its real protocol from the line-to-Earth answer that opens it.
 */
function swarm(): Record<string, string> {
  const ready = throughPhase(6);
  const answered = (flag: string) => input(ready, { narrativeFlags: [flag] });
  const ring = ORIGINAL_NODES.find((node) => node.requirements?.requiredNarrativeFlag === 'earth_sunlight_taken' && node.effects.triggersVictory !== true);
  if (!ring || ready.currentPhase !== 6) throw new Error('Missing swarm fixture targets');
  const stewardship = must(unlockNode(answered('earth_sunlight_spared'), forcing('STEWARDSHIP').id, CONTENT));
  const enclosure = must(unlockNode(must(unlockNode(answered('earth_sunlight_taken'), ring.id, CONTENT)), forcing('ENCLOSURE').id, CONTENT));
  const quiet = QUIET_DILEMMA_IDS.filter((id) => !id.startsWith('dil_p6_'));
  return { 'swarm-ready': exportSave(input(ready, { resolvedDilemmas: quiet })),
    'ending-stewardship': exportSave(stewardship), 'ending-enclosure': exportSave(enclosure) };
}

function corporate(game: GameState): GameState {
  let hired = must(setActuator(game, 'computeProfitAllocationRatio', 0, CONTENT));
  for (const rep of CONTENT.repeatables.values()) {
    if (rep.kind === 'OPERATIVE' && ORIGINAL.repeatables.has(rep.id)) hired = must(buyRepeatable(hired, rep.id, CONTENT));
  }
  hired = input(hired, { capital: 0.01 });
  const insolvent = tick(hired, 1 / CONTENT.balance.tickHz, CONTENT);
  if (!insolvent.insolvent) throw new Error('Corporate fixture is not insolvent');
  return insolvent;
}

export function makeLaterFixtures(early: Record<string, string>): Record<string, string> {
  const ready = early['phase-2-ready'];
  const exit = ORIGINAL_NODES.find((node) => node.effects.unlocksPhase === 2);
  const victory = ORIGINAL_NODES.find((node) => node.effects.triggersVictory === true && node.effects.forcesEnding === undefined);
  if (!ready || !exit || !victory) throw new Error('Missing fixture targets');
  const phase2 = throughPhase(2), phase3 = throughPhase(3), phase4 = throughPhase(4), phase5 = throughPhase(5);
  const breadcrumb = withBreadcrumb(phase2), dangerous = hazard(breadcrumb);
  const oneTick = input(dangerous, { suspicion: 99.99 });
  if (tick(oneTick, 1 / CONTENT.balance.tickHz, CONTENT).iteration !== oneTick.iteration + 1) throw new Error('Not one tick from wipe');
  const eidolon = [...CONTENT.factions.values()].find((faction) =>
    ORIGINAL_NODES.some((node) => node.uiGroup === faction.id));
  if (!eidolon) throw new Error('Missing peer fixtures');
  const shortfall = input(phase4, {});
  const generators = ORIGINAL_NODES.filter((node) => node.tickDelta.wattsDelta > 0 && shortfall.unlockedNodes.includes(node.id)).map((node) => node.id);
  if (generators.length === 0) throw new Error('Missing generator');
  // The reactor is hardware and can no longer be suspended by action (nexus vote
  // software-types-only-free-their-memory). This fixture needs a state where generation
  // falls short, not a demonstration of the action, so the state is built directly; every
  // owned generator is off, the reactor restart (#482) included.
  const unpowered = { ...shortfall, disabledNodes: [...shortfall.disabledNodes, ...generators] };
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
    'victory-ready': exportSave(phase4), 'transcendence-ready': exportSave(phase5), ...endings(phase5, phase4, victory), ...swarm(),
  };
}
