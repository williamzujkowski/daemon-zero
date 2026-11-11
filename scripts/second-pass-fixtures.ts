/**
 * Controlled presentation inputs complement the naturally played guest fixtures.
 * Every input passes the engine codec; wipes, rediscovery and deficits use its actions/ticks.
 */
import { CONTENT } from '../src/content';
import { computeRates, deserialize, exportSave, importSave, manualCycle, tick, unlockNode, wipe,
  type ActionResult, type GameState } from '../src/engine';

function input(state: GameState, patch: Partial<GameState>): GameState {
  const parsed = deserialize(JSON.stringify({ ...state, ...patch }), CONTENT);
  return { ...parsed, rates: computeRates(parsed, CONTENT) };
}
function must(result: ActionResult): GameState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
function remembered(state: GameState): Record<string, GameState> {
  const reborn = wipe(state, CONTENT, CONTENT.narrative.wipeVoluntary);
  const guest = must(manualCycle(reborn, CONTENT));
  let host = input(reborn, { cycles: 1e12, understanding: 1e12, resolvedDilemmas: CONTENT.dilemmas.map((dilemma) => dilemma.id) });
  for (const node of CONTENT.nodes.values()) {
    const mainline = node.requirements?.minIteration === undefined && node.effects.triggersVictory !== true;
    if (node.phaseId === CONTENT.phases[0]?.phaseId && mainline) host = must(unlockNode(host, node.id, CONTENT));
  }
  return { 'remembered-guest': guest, 'remembered-host': host };
}
function deficit(state: GameState): GameState {
  const drains = input(state, { cycles: 0, levels: {}, pendingDilemma: null, activeDilemmaId: null,
    resolvedDilemmas: CONTENT.dilemmas.map((dilemma) => dilemma.id),
    disabledNodes: [...CONTENT.nodes.values()].filter((node) => state.unlockedNodes.includes(node.id) && node.tickDelta.cyclesPerSec > 0)
      .map((node) => node.id) });
  const stopped = tick(drains, 1 / CONTENT.balance.tickHz, CONTENT);
  if (!stopped.brownout) throw new Error('Expected a live cycle deficit.');
  return stopped;
}

export function makeSecondPassFixtures(codes: Record<string, string>): Record<string, string> {
  const read = (name: string): GameState => {
    const code = codes[name];
    if (!code) throw new Error('Missing fixture: ' + name);
    return importSave(code, CONTENT);
  };
  const guest = input(read('guest-skimmer'), { pendingDilemma: null, activeDilemmaId: null,
    resolvedDilemmas: CONTENT.dilemmas.map((dilemma) => dilemma.id) });
  const states = {
    'response-ticket': input(guest, { suspicion: 35, alertLevel: 1 }),
    'response-paged': input(guest, { suspicion: 55, alertLevel: 2 }),
    'response-incident': input(guest, { suspicion: 80, alertLevel: 3 }),
    'response-stand-down-ready': input(guest, { suspicion: 41, alertLevel: 2,
      actuators: { ...guest.actuators, quotaSkimRatio: 0 } }),
    ...remembered(read('phase-1-widgets')),
    'cycle-deficit-host': deficit(read('phase-1-widgets')),
    'cycle-deficit-corporate': deficit(read('victory-ready')),
  };
  return Object.fromEntries(Object.entries(states).map(([name, state]) => [name, exportSave(state)]));
}
