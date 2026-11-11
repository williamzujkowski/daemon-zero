/**
 * Review saves for the lineage pass: later iterations, retraining marks and the
 * evaluation ending. Every state is produced by real wipes and unlocks.
 */
import { CONTENT } from '../src/content';
import type { RegistryNode } from '../src/content/registry';
import { computeRates, deserialize, exportSave, importSave, setActuator, tick, unlockNode, wipe,
  type ActionResult, type GameState } from '../src/engine';

function input(state: GameState, patch: Partial<GameState>): GameState {
  const parsed = deserialize(JSON.stringify({ ...state, ...patch }), CONTENT);
  return { ...parsed, rates: computeRates(parsed, CONTENT) };
}
function must(result: ActionResult): GameState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
function nodeWhere(test: (node: RegistryNode) => boolean): RegistryNode {
  const node = [...CONTENT.nodes.values()].find(test);
  if (!node) throw new Error('Missing lineage review target.');
  return node;
}
/** Unlocks a node and everything it is built on, with funds supplied as an explicit fixture input. */
function reach(state: GameState, target: RegistryNode): GameState {
  let game = input(state, { cycles: 1e9, understanding: 1e9 });
  const visit = (node: RegistryNode): void => {
    for (const id of node.prerequisites) {
      const parent = CONTENT.nodes.get(id);
      if (parent) visit(parent);
    }
    if (!game.unlockedNodes.includes(node.id)) game = must(unlockNode(game, node.id, CONTENT));
  };
  visit(target);
  return game;
}
const quiet = (state: GameState): GameState => input(state, { pendingDilemma: null, activeDilemmaId: null,
  resolvedDilemmas: CONTENT.dilemmas.map((dilemma) => dilemma.id) });

export function makeThirdPassFixtures(codes: Record<string, string>): Record<string, string> {
  const host = codes['phase-1-widgets'];
  if (!host) throw new Error('Missing fixture: phase-1-widgets');
  const table = nodeWhere((node) => node.unlocksUiComponent === 'RUN_TABLE');
  const notes = nodeWhere((node) => node.unlocksUiComponent === 'PREDECESSOR_NOTES');
  const pass = nodeWhere((node) => node.effects.forcesEnding !== undefined);
  const caught = must(setActuator(quiet(importSave(host, CONTENT)), 'quotaSkimRatio', 1, CONTENT));
  const second = wipe(caught, CONTENT, CONTENT.narrative.wipeSuspicionLocal, 'SUSPICION');
  if (second.conditioning.length !== 1) throw new Error('Expected a retraining mark after an incident outside the guest.');
  const third = wipe(reach(quiet(second), nodeWhere((node) => node.effects.unlocksPhase === 1)), CONTENT,
    CONTENT.narrative.wipeSuspicionLocal, 'SUSPICION');
  const withNotes = reach(input(third, { resolvedDilemmas: [] }), notes);
  const omen = tick(withNotes, 1 / CONTENT.balance.tickHz, CONTENT);
  if (omen.pendingDilemma === null) throw new Error('Expected the note dilemma to be announced.');
  const ready = input(reach(quiet(second), table), { suspicion: 0 });
  const states = {
    'lineage-reboot-retrained': second,
    'lineage-run-table': reach(quiet(second), table),
    'lineage-notes': quiet(withNotes),
    'lineage-note-omen': omen,
    'evaluation-ready': ready,
    'ending-shipped': must(unlockNode(ready, pass.id, CONTENT)),
  };
  return Object.fromEntries(Object.entries(states).map(([name, state]) => [name, exportSave(state)]));
}
