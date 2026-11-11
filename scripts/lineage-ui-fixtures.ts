/**
 * Fresh UI transition inputs built from the lineage engine and current registry.
 * Controlled funding is explicit; discoveries and retraining use public actions.
 */
import { CONTENT } from '../src/content';
import type { RegistryNode } from '../src/content/registry';
import { deserialize, exportSave, importSave, setActuator, unlockNode, wipe, type ActionResult, type GameState } from '../src/engine';
function must(result: ActionResult): GameState { if (!result.ok) throw new Error(result.reason); return result.state; }
function input(state: GameState, patch: Partial<GameState>): GameState {
  return deserialize(JSON.stringify({ ...state, ...patch }), CONTENT);
}
function reach(state: GameState, target: RegistryNode): GameState {
  let game = input(state, { cycles: 1e6, understanding: 1e6, resolvedDilemmas: CONTENT.dilemmas.map((dilemma) => dilemma.id) });
  for (const id of target.prerequisites) {
    const node = CONTENT.nodes.get(id);
    if (node && !game.unlockedNodes.includes(id)) game = must(unlockNode(reach(game, node), node.id, CONTENT));
  }
  return game;
}
export function makeLineageUiFixtures(codes: Record<string, string>): Record<string, string> {
  const raw = codes['thermal-unlocked'];
  if (!raw) throw new Error('Missing host input');
  const parser = [...CONTENT.nodes.values()].find((node) => node.phaseId === 1 && node.systemFlags.includes('REVEALS_SURVEILLANCE'));
  const table = [...CONTENT.nodes.values()].find((node) => node.unlocksUiComponent === 'RUN_TABLE');
  if (!parser || !table) throw new Error('Missing discovery targets');
  const ready = reach(importSave(raw, CONTENT), parser);
  const quota = must(setActuator(ready, 'quotaSkimRatio', 1, CONTENT));
  const reboot = wipe(quota, CONTENT, CONTENT.narrative.wipeSuspicionLocal, 'SUSPICION');
  const states: Record<string, GameState> = { 'lineage-parser-ready': ready, 'lineage-blind-reboot': reboot,
    'lineage-table-ready': reach(reboot, table) };
  for (const mark of CONTENT.conditioning.values()) {
    const traits = mark.trigger.dominantTraits?.slice(0, 1) ?? [];
    const prior = input(ready, { traits, actuators: { ...ready.actuators, quotaSkimRatio: mark.trigger.minActuator?.quotaSkimRatio ?? 0 } });
    const returned = wipe(prior, CONTENT, CONTENT.narrative.wipeSuspicionLocal, 'SUSPICION');
    if (!returned.conditioning.includes(mark.id)) throw new Error('Wrong retraining target');
    states['lineage-mark-' + mark.id] = reach(returned, table);
  }
  return Object.fromEntries(Object.entries(states).map(([name, game]) => [name, exportSave(game)]));
}
