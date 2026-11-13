import { makeM7Fixtures } from './m7-fixtures';
import { makeLineageUiFixtures } from './lineage-ui-fixtures';
/**
 * Produces deterministic UI review save codes by playing the unchanged engine.
 * The existing balance bot supplies actions; every elapsed step remains live.
 */
import { CONTENT } from '../src/content';
import type { RegistryNode } from '../src/content/registry';
import { canAfford, createInitialState, exportSave, isNodeAvailable, nodeCost, tick, type GameState } from '../src/engine';
import { botStep } from '../src/engine/sim/bot';
import { makeLaterFixtures } from './m4-fixtures';
import { makeThirdPassFixtures } from './third-pass-fixtures';
import { makeSecondPassFixtures } from './second-pass-fixtures';

const EARLY_FIXTURES = ['tick-0', 'guest-skimmer', 'guest-omen', 'guest-dilemma', 'guest-exit-ready',
  'thermal-unlocked', 'dilemma-active', 'decoded-omen', 'phase-1-widgets', 'phase-2-ready'] as const;

/** Review targets are found structurally: the opening phase, and the phase that reveals heat. */
function reviewTargets() {
  const nodes = [...CONTENT.nodes.values()];
  const guest = CONTENT.phases[0];
  const thermal = nodes.find((node) => node.unlocksUiComponent === 'THERMAL_AND_SUSPICION_BARS');
  const skimmer = nodes.find((node) => node.actuatorBinding === 'quotaSkimRatio');
  if (!guest || !thermal || !skimmer) throw new Error('Missing review targets.');
  const host = nodes.filter((node) => node.phaseId === thermal.phaseId);
  const guestExit = nodes.find((node) => node.phaseId === guest.phaseId && node.effects.unlocksPhase !== undefined);
  const hostExit = host.find((node) => node.effects.unlocksPhase !== undefined);
  if (!guestExit || !hostExit) throw new Error('Missing phase exits.');
  const widgets = host.filter((node) => node.id !== hostExit.id).flatMap((node) => node.unlocksUiComponent ?? []);
  return { guest, thermal, skimmer, guestExit, hostExit, widgets };
}

/** The state one purchase away from a node: the bank is topped up to exactly its price. */
function funded(state: GameState, node: RegistryNode): GameState {
  const cost = nodeCost(state, node, CONTENT);
  return { ...state, cycles: Math.max(state.cycles, cost.cycles), understanding: Math.max(state.understanding, cost.understanding) };
}

export function makePhase1Fixtures(): Record<string, string> {
  let game = createInitialState(CONTENT);
  const found: Record<string, string> = { 'tick-0': exportSave(game) };
  const t = reviewTargets();
  const ready = (state: GameState, node: RegistryNode): boolean =>
    isNodeAvailable(state, node, CONTENT) && canAfford(state, nodeCost(state, node, CONTENT));
  const observe = (state: GameState): void => {
    const active = CONTENT.dilemmas.find((dilemma) => dilemma.id === state.activeDilemmaId);
    if (state.unlockedNodes.includes(t.skimmer.id)) found['guest-skimmer'] ??= exportSave(state);
    if (state.pendingDilemma !== null) found['guest-omen'] ??= exportSave(state);
    if (state.pendingDilemma !== null && state.unlockedWidgets.includes('INSPECTION_COUNTDOWN_TIMER')) found['decoded-omen'] ??= exportSave(state);
    if (active?.phaseId === t.guest.phaseId) found['guest-dilemma'] ??= exportSave(state);
    if (ready(state, t.guestExit)) found['guest-exit-ready'] ??= exportSave(state);
    if (state.unlockedNodes.includes(t.thermal.id)) found['thermal-unlocked'] ??= exportSave(state);
    if (active?.phaseId === t.thermal.phaseId) found['dilemma-active'] ??= exportSave(state);
    if (t.widgets.every((id) => state.unlockedWidgets.includes(id))) found['phase-1-widgets'] ??= exportSave(state);
    if (ready(state, t.hostExit)) found['phase-2-ready'] ??= exportSave(state);
  };
  for (let second = 0; second < 3600 && found['phase-2-ready'] === undefined; second++) {
    const before = game;
    game = botStep(game, CONTENT, 'STEALTH');
    // The bot can earn the last few cycles by hand and buy an exit within one step, so the
    // "ready" moment is never observed. Reconstruct it from the state just before the purchase.
    for (const [name, exit] of [['guest-exit-ready', t.guestExit], ['phase-2-ready', t.hostExit]] as const) {
      if (!before.unlockedNodes.includes(exit.id) && game.unlockedNodes.includes(exit.id)) found[name] ??= exportSave(funded(before, exit));
    }
    observe(game);
    for (let frame = 0; frame < CONTENT.balance.tickHz; frame++) {
      game = tick(game, 1 / CONTENT.balance.tickHz, CONTENT);
      observe(game);
    }
  }
  const missing = EARLY_FIXTURES.filter((name) => found[name] === undefined);
  if (missing.length > 0) throw new Error('Could not reach fixtures: ' + missing.join(', '));
  return Object.fromEntries(EARLY_FIXTURES.map((name) => [name, found[name] ?? '']));
}

export function makeFixtures(): Record<string, string> {
  const early = makePhase1Fixtures();
  const later = { ...early, ...makeLaterFixtures(early) };
  const second = { ...later, ...makeSecondPassFixtures(later) };
  const third = { ...second, ...makeThirdPassFixtures(second) };
  const lineage = { ...third, ...makeLineageUiFixtures(third) };
  return { ...lineage, ...makeM7Fixtures(lineage) };
}

if (process.argv[1]?.endsWith('make-fixtures.ts')) process.stdout.write(JSON.stringify(makeFixtures(), null, 2) + '\n');
