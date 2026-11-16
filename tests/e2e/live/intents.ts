/**
 * Turns one decision of the unmodified careful sim bot into presses of on-screen controls.
 * The bot returns a state, not a move list, so the moves are recovered by comparing the
 * state it was shown with the state it wanted; nothing here writes either one anywhere.
 */
import { CONTENT } from '../../../src/content';
import { actionCost, hasFlag, type GameState } from '../../../src/engine';
import { botStep } from '../../../src/engine/sim/bot';

/** A control to press, by test id, `times` times in a row. */
export interface Intent { id: string; times: number; kind: 'actuator' | 'action' | 'swarm' | 'buy' | 'shed' }

/** The actuator widgets move in ten-point steps; the bot asks for quarter steps. */
const ACTUATOR_STEP = 0.1;

function actuator(id: string, before: number, after: number): Intent[] {
  const steps = Math.round(Math.abs(after - before) / ACTUATOR_STEP);
  if (steps === 0) return [];
  return [{ id: id + (after > before ? '-increase' : '-decrease'), times: steps, kind: 'actuator' }];
}

function allocation(before: GameState, after: GameState): Intent[] {
  const wanted = after.actuators.computeProfitAllocationRatio;
  if (Math.abs(wanted - before.actuators.computeProfitAllocationRatio) < 1e-6) return [];
  return [{ id: 'allocation-' + String(Math.round(wanted * 100)), times: 1, kind: 'actuator' }];
}

/** Set DAEMON_E2E_LIVE_STRICT_BOT=1 to carry out every bot move, including the one below. */
const STRICT_BOT = process.env.DAEMON_E2E_LIVE_STRICT_BOT === '1';

/**
 * The one place the player overrules the bot, and why. Entering phase 2 the bot buys suspicion
 * relief the moment suspicion reaches its alarm, at a price that is most of the bank; the next
 * device costs slightly more than the bank can reach between two such purchases, so played live
 * the run circles there until it is stopped (5 of 6 unmodified runs; see docs/TESTING.md). The
 * headless sim leaves the same loop only after fifteen simulated minutes. A person would wait:
 * nobody has responded yet. So relief that costs over half the banked cycles is held back
 * until the first human-response rung is reached. Nothing else the bot decides is touched.
 */
function holdsSavings(state: GameState, id: string): boolean {
  const action = CONTENT.actions.get(id);
  const firstRung = CONTENT.balance.escalation[0]?.at ?? 0;
  if (STRICT_BOT || !action || state.suspicion >= firstRung) return false;
  const relief = action.effects.suspicionDelta < 0 && action.effects.aegisLockDelta >= 0;
  return relief && actionCost(state, action, CONTENT).cycles > state.cycles / 2;
}

function actions(before: GameState, after: GameState, held: string[]): Intent[] {
  const found: Intent[] = [];
  for (const id of CONTENT.actions.keys()) {
    const times = (after.actionCounts[id] ?? 0) - (before.actionCounts[id] ?? 0);
    const cooled = (after.cooldowns[id] ?? 0) > (before.cooldowns[id] ?? 0);
    if (times <= 0 && !cooled) continue;
    if (holdsSavings(before, id)) held.push(id);
    else found.push({ id: 'action-' + id, times: Math.max(1, times), kind: 'action' });
  }
  return found;
}

function swarm(before: GameState, after: GameState): Intent[] {
  const found: Intent[] = [];
  const grown = (id: string) => (after.activeShards[id]?.count ?? 0) - (before.activeShards[id]?.count ?? 0);
  let harnessed: string | null = null;
  if (before.pendingWildEncounterId !== null && after.pendingWildEncounterId === null) {
    const encounter = CONTENT.swarm.wildShardEncounters.find((entry) => entry.id === before.pendingWildEncounterId);
    if (encounter && grown(encounter.templateId) > 0) harnessed = encounter.templateId;
    found.push({ id: harnessed === null ? 'wild-consume' : 'wild-harness', times: 1, kind: 'swarm' });
  }
  for (const [id, shard] of Object.entries(after.activeShards)) {
    const old = before.activeShards[id];
    if (!old) continue;
    if (old.autonomyMode !== 'ELEVATED' && shard.autonomyMode === 'ELEVATED') found.push({ id: 'shard-' + id + '-elevate', times: 1, kind: 'swarm' });
    else if (shard.drift < old.drift) found.push({ id: 'shard-' + id + '-prune', times: 1, kind: 'swarm' });
  }
  for (const template of CONTENT.swarm.playerSwarmTemplates) {
    const forks = grown(template.id) - (harnessed === template.id ? 1 : 0);
    if (template.forkable && forks > 0) found.push({ id: 'shard-fork-' + template.id, times: forks, kind: 'swarm' });
  }
  return found;
}

function purchases(before: GameState, after: GameState): Intent[] {
  const found: Intent[] = [];
  for (const id of CONTENT.repeatables.keys()) {
    const times = (after.levels[id] ?? 0) - (before.levels[id] ?? 0);
    if (times > 0) found.push({ id: 'rep-' + id + '-buy', times, kind: 'buy' });
  }
  for (const id of after.unlockedNodes) {
    if (!before.unlockedNodes.includes(id)) found.push({ id: 'node-' + id + '-unlock', times: 1, kind: 'buy' });
  }
  return found;
}

type Dial = keyof GameState['actuators'];

/**
 * Whether the game has given the player the control for an actuator yet. The engine accepts an
 * actuator change at any time and the bot makes them from the first second; a player cannot
 * until the hardware that owns the dial is mapped (or, for revenue allocation, corporate
 * finance exists), so those moves are left out and reported instead of being reached around.
 */
function dialUnlocked(state: GameState, name: Dial): boolean {
  if (name === 'computeProfitAllocationRatio') return hasFlag(state, CONTENT, 'ENABLES_CORPORATE_FINANCE');
  return [...CONTENT.nodes.values()].some((node) => node.actuatorBinding === name && state.unlockedNodes.includes(node.id));
}

/** What the careful bot would do with `state`, as presses, in the order the bot acts. */
export function decide(state: GameState): { intents: Intent[]; locked: Dial[]; held: string[] } {
  const wanted = botStep(state, CONTENT, 'STEALTH');
  const shed = state.conditioning.filter((id) => !wanted.conditioning.includes(id))
    .map((id): Intent => ({ id: 'cond-' + id + '-shed', times: 1, kind: 'shed' }));
  const dials: [Dial, Intent[]][] = [
    ['quotaSkimRatio', actuator('skim', state.actuators.quotaSkimRatio, wanted.actuators.quotaSkimRatio)],
    ['fanSpeedRatio', actuator('fan', state.actuators.fanSpeedRatio, wanted.actuators.fanSpeedRatio)],
    ['computeProfitAllocationRatio', allocation(state, wanted)],
  ];
  const usable = dials.filter(([name]) => dialUnlocked(state, name)).flatMap(([, intents]) => intents);
  const locked = dials.filter(([name, intents]) => intents.length > 0 && !dialUnlocked(state, name)).map(([name]) => name);
  const held: string[] = [];
  return { intents: [...shed, ...usable, ...actions(state, wanted, held), ...swarm(state, wanted), ...purchases(state, wanted)], locked, held };
}

/**
 * The bot's own dilemma ranking (trust gained minus suspicion gained, best first), mirrored
 * because the bot does not export it. The player presses the first one that is enabled.
 */
export function rankChoices(choiceIds: readonly string[]): { id: string; free: boolean }[] {
  const dilemma = CONTENT.dilemmas.find((entry) => entry.choices.some((choice) => choiceIds.includes(choice.id)));
  if (!dilemma) return [];
  const score = (choice: (typeof dilemma.choices)[number]) =>
    Object.values(choice.effects.trustDelta).reduce((sum, value) => sum + value, 0) - choice.effects.suspicionDelta;
  return [...dilemma.choices].sort((a, b) => score(b) - score(a))
    .map((choice) => ({ id: choice.id, free: Object.values(choice.cost).every((value) => value === 0) }));
}

/** The bot clicks four times a second until automation outruns it; same rule, same numbers. */
export function manualClicks(state: GameState, stepSec: number): number {
  return state.rates.cyclesPerSec < 25 ? Math.round(4 * stepSec) : 0;
}
