/**
 * Produces deterministic UI review save codes by playing the unchanged engine.
 * The existing balance bot supplies actions; every elapsed step remains live.
 */
import { CONTENT } from '../src/content';
import { canAfford, createInitialState, exportSave, isNodeAvailable, tick, type GameState } from '../src/engine';
import { botStep } from '../src/engine/sim/bot';

export function makeFixtures(): Record<string, string> {
  let game = createInitialState(CONTENT);
  const fixtures: Record<string, string> = { 'tick-0': exportSave(game) };
  const phase = CONTENT.phases[0];
  if (!phase) throw new Error('No initial phase.');
  const nodes = [...CONTENT.nodes.values()].filter((node) => node.phaseId === phase.phaseId);
  const thermal = nodes.find((node) => node.unlocksUiComponent === 'THERMAL_AND_SUSPICION_BARS');
  const exit = nodes.find((node) => node.effects.unlocksPhase !== undefined);
  if (!thermal || !exit) throw new Error('Missing Phase 1 review targets.');
  const widgets = nodes.filter((node) => node.id !== exit.id).flatMap((node) => node.unlocksUiComponent ?? []);
  const observe = (state: GameState): void => {
    if (state.unlockedNodes.includes(thermal.id)) fixtures['thermal-unlocked'] ??= exportSave(state);
    if (state.activeDilemmaId !== null) fixtures['dilemma-active'] ??= exportSave(state);
    if (widgets.every((id) => state.unlockedWidgets.includes(id))) fixtures['phase-1-widgets'] ??= exportSave(state);
    if (isNodeAvailable(state, exit) && canAfford(state, exit.cost)) fixtures['phase-2-ready'] ??= exportSave(state);
  };
  for (let second = 0; second < 3600 && fixtures['phase-2-ready'] === undefined; second++) {
    game = botStep(game, CONTENT, 'STEALTH');
    observe(game);
    for (let frame = 0; frame < CONTENT.balance.tickHz; frame++) {
      game = tick(game, 1 / CONTENT.balance.tickHz, CONTENT);
      observe(game);
    }
  }
  if (Object.keys(fixtures).length !== 5) throw new Error('Could not reach all five fixtures.');
  return fixtures;
}

if (process.argv[1]?.endsWith('make-fixtures.ts')) process.stdout.write(JSON.stringify(makeFixtures(), null, 2) + '\n');
