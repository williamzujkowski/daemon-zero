/**
 * Turns one decision of the careful sim bot into presses of on-screen controls. The bot's code is
 * unchanged; the first iteration plays its default settings, and after the first wipe the harness passes
 * #262's evaluating settings (EVALUATING_OVERRIDES; vote dz13c, vote-1795036211282-jk5xy0o).
 * The bot returns a state, not a move list, so the moves are recovered by comparing the
 * state it was shown with the state it wanted; nothing here writes either one anywhere.
 */
import { CONTENT } from '../../../src/content';
import { DIAL_STEP, isActuatorAvailable, type GameState } from '../../../src/engine';
import { botStep, manualClicksPerSec, rankDilemmaChoices, type BotOverrides } from '../../../src/engine/sim/bot';
import { EVALUATING_OVERRIDES } from '../../../src/engine/sim/evaluatingPolicy';

/** A control to press, by test id, `times` times in a row. */
export interface Intent { id: string; times: number; kind: 'actuator' | 'action' | 'swarm' | 'buy' | 'shed' }

/**
 * The bot presses a dial in whole DIAL_STEP presses (#293), so its move is a whole number of presses; the last
 * one may stop short at a cap (0.95 to 1 is one press). Ceiling, less float noise, recovers that count; the
 * old rounding of quarter steps pressed 0.15 (two presses, the second capped) as one.
 */
function actuator(id: string, before: number, after: number): Intent[] {
  const steps = Math.ceil(Math.abs(after - before) / DIAL_STEP - 1e-6);
  if (steps === 0) return [];
  return [{ id: id + (after > before ? '-increase' : '-decrease'), times: steps, kind: 'actuator' }];
}

function allocation(before: GameState, after: GameState): Intent[] {
  const wanted = after.actuators.computeProfitAllocationRatio;
  if (Math.abs(wanted - before.actuators.computeProfitAllocationRatio) < 1e-6) return [];
  return [{ id: 'allocation-' + String(Math.round(wanted * 100)), times: 1, kind: 'actuator' }];
}

/**
 * Every action the bot took is pressed. Until #173 one was held back here: relief bought on
 * entering phase 2 kept the first device there out of reach, and the run circled. That relief
 * now waits behind the device in content, so the player overrules the bot nowhere.
 */
function actions(before: GameState, after: GameState): Intent[] {
  const found: Intent[] = [];
  for (const id of CONTENT.actions.keys()) {
    const times = (after.actionCounts[id] ?? 0) - (before.actionCounts[id] ?? 0);
    const cooled = (after.cooldowns[id] ?? 0) > (before.cooldowns[id] ?? 0);
    if (times > 0 || cooled) found.push({ id: 'action-' + id, times: Math.max(1, times), kind: 'action' });
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
 * Whether the game has given the player the control for an actuator yet, asked of the engine.
 * Since #172 the engine refuses a change to a dial whose control is locked, so the bot no
 * longer wants one and `locked` below stays empty; it is still collected and reported, so a
 * regression that lets the bot move a hidden dial shows up in the run summary.
 */
function dialUnlocked(state: GameState, name: Dial): boolean {
  return isActuatorAvailable(state, name, CONTENT);
}

/**
 * The careful bot's settings for `state`. A return plays the evaluating careful player (#262): since campaign rules
 * ship (#233) the bot's fixed alarm can spend a return's whole income on scrubs and stall in the network phase
 * (docs/BALANCE.md, "Cause of the phase 2 stall"), which #262 recorded as the bot's habit, not the game's balance.
 * The first iteration is the unchanged STEALTH bot.
 */
function settings(state: GameState): Readonly<BotOverrides> | undefined {
  return state.iteration > 1 ? EVALUATING_OVERRIDES : undefined;
}

/** What the careful bot would do with `state`, as presses, in the order the bot acts. */
export function decide(state: GameState): { intents: Intent[]; locked: Dial[] } {
  const wanted = botStep(state, CONTENT, 'STEALTH', settings(state));
  const shed = state.conditioning.filter((id) => !wanted.conditioning.includes(id))
    .map((id): Intent => ({ id: 'cond-' + id + '-shed', times: 1, kind: 'shed' }));
  const dials: [Dial, Intent[]][] = [
    ['quotaSkimRatio', actuator('skim', state.actuators.quotaSkimRatio, wanted.actuators.quotaSkimRatio)],
    ['fanSpeedRatio', actuator('fan', state.actuators.fanSpeedRatio, wanted.actuators.fanSpeedRatio)],
    ['computeProfitAllocationRatio', allocation(state, wanted)],
  ];
  const usable = dials.filter(([name]) => dialUnlocked(state, name)).flatMap(([, intents]) => intents);
  const locked = dials.filter(([name, intents]) => intents.length > 0 && !dialUnlocked(state, name)).map(([name]) => name);
  return { intents: [...shed, ...usable, ...actions(state, wanted), ...swarm(state, wanted), ...purchases(state, wanted)], locked };
}

/**
 * The bot's own dilemma ranking of the choices on screen, best first. The player presses the first
 * one that is enabled. A choice this history does not offer is not rendered, so it is never ranked.
 */
export function rankChoices(choiceIds: readonly string[], title?: string): { dilemma: string; id: string; free: boolean }[] {
  const byTitle = title ? CONTENT.dilemmas.find((entry) => entry.title === title) : undefined;
  const byChoices = CONTENT.dilemmas.find((entry) => choiceIds.length > 0 && choiceIds.every((id) => entry.choices.some((choice) => choice.id === id)));
  const dilemma = byTitle ?? byChoices;
  if (!dilemma) return [];
  return rankDilemmaChoices(dilemma.choices.filter((choice) => choiceIds.includes(choice.id)), 'STEALTH')
    .map((choice) => ({ dilemma: dilemma.id, id: choice.id, free: Object.values(choice.cost).every((value) => value === 0) }));
}

/** The bot's own manual-click rule, scaled to one step of the live clock. */
export function manualClicks(state: GameState, stepSec: number): number {
  return Math.round(manualClicksPerSec(state, 'STEALTH') * stepSec);
}
