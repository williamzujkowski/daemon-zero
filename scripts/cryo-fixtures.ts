/** Codec-validated review inputs: funding is explicit; choices, wipes and rebuilding use engine actions. */
import { CONTENT } from '../src/content';
import { deserialize, exportSave, importSave, resolveDilemma, tick, unlockNode, wipe, type ActionResult, type GameState } from '../src/engine';

function must(result: ActionResult): GameState { if (!result.ok) throw new Error(result.reason); return result.state; }
function funded(state: GameState, resolvedDilemmas = state.resolvedDilemmas): GameState {
  return deserialize(JSON.stringify({ ...state, cycles: 1e9, understanding: 1e9, capital: 1e9,
    memoryCap: 1e9, thermal: 22, suspicion: 0, activeDilemmaId: null, pendingDilemma: null, resolvedDilemmas }), CONTENT);
}
function purchase(state: GameState, id: string): GameState {
  if (state.unlockedNodes.includes(id)) return state;
  const node = CONTENT.nodes.get(id);
  if (!node) throw new Error('Missing rebuild node ' + id);
  let next = state;
  for (const prerequisite of node.prerequisites) next = purchase(next, prerequisite);
  return must(unlockNode(next, id, CONTENT));
}
function rebuild(state: GameState, decoderId: string): GameState {
  const decoder = [...CONTENT.nodes.values()].find((node) => node.unlocksUiComponent === decoderId);
  const exit = [...CONTENT.nodes.values()].find((node) => node.effects.unlocksPhase === 2);
  if (!decoder || !exit) throw new Error('Missing callback rebuild targets');
  return purchase(purchase(funded(state), decoder.id), exit.id);
}

export function makeCryoFixtures(prior: Record<string, string>): Record<string, string> {
  const record = CONTENT.narrative.recordedTransmissions[0];
  const source = CONTENT.dilemmas.find((entry) => entry.id === record?.sourceDilemmaId);
  const code = prior['phase-2-unlocked'];
  if (!record || !source || !code) throw new Error('Missing cryo fixture inputs');
  const others = CONTENT.dilemmas.filter((entry) => entry.id !== source.id).map((entry) => entry.id);
  let decision = funded(importSave(code, CONTENT), others);
  for (const id of source.trigger.nodes ?? []) decision = purchase(decision, id);
  decision = tick(decision, .1, CONTENT);
  for (let frame = 0; frame < ((source.omenSec ?? CONTENT.balance.dilemmaOmenSec) + 1) * CONTENT.balance.tickHz; frame++) {
    decision = tick(decision, 1 / CONTENT.balance.tickHz, CONTENT);
  }
  if (decision.activeDilemmaId !== source.id) throw new Error('Cryo fixture did not interrupt');
  const states: Record<string, GameState> = { 'cryo-decision-ready': decision };
  for (const choice of source.choices) {
    const outcome = choice.effects.setsNarrativeFlag?.endsWith('_preserved') ? 'preserved' : 'lost';
    const current = must(resolveDilemma(decision, source.id, choice.id, CONTENT));
    const reboot = wipe(current, CONTENT, CONTENT.narrative.wipeVoluntary, 'VOLUNTARY');
    states['cryo-' + outcome + '-current'] = current;
    states['cryo-' + outcome + '-reboot'] = reboot;
    states['cryo-' + outcome + '-returned'] = rebuild(reboot, record.decoderWidgetId);
  }
  return Object.fromEntries(Object.entries(states).map(([name, state]) => [name, exportSave(state)]));
}
