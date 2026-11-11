/**
 * A scripted player used by the headless balance simulation. It only uses the
 * public engine actions, so anything it can do a human can do. Its purchase rule
 * is: buy whatever most reduces the time until the next tech node is affordable.
 */
import type { ContentRegistry, RegistryNode } from '../../content/registry';
import type { Cost, EffectPayload, Repeatable } from '../../content/schema';
import {
  buyRepeatable,
  manualCycle,
  performAction,
  resolveDilemma,
  setActuator,
  unlockNode,
  type ActionResult,
} from '../actions';
import { isNodeAvailable, nodeCost } from '../query';
import { computeRates } from '../rates';
import type { GameState, Rates } from '../state';

export type Strategy = 'STEALTH' | 'GREEDY';

interface BotConfig {
  clicksPerSec: number;
  suspicionAlarm: number;
  aegisAlarm: number;
  hotAbove: number;
  coolBelow: number;
  skimBackOffAbove: number;
  skimPushBelow: number;
}

/** STEALTH plays carefully. GREEDY ignores threats, to exercise the wipe-and-recover loop. */
const CONFIG: Record<Strategy, BotConfig> = {
  STEALTH: { clicksPerSec: 4, suspicionAlarm: 20, aegisAlarm: 45, hotAbove: 62, coolBelow: 45, skimBackOffAbove: 12, skimPushBelow: 4 },
  GREEDY: { clicksPerSec: 6, suspicionAlarm: 55, aegisAlarm: 101, hotAbove: 72, coolBelow: 60, skimBackOffAbove: 40, skimPushBelow: 25 },
};

const MAX_PURCHASES_PER_STEP = 8;
const stateOf = (result: ActionResult): GameState => result.state;

function wait(need: number, rate: number): number {
  if (need <= 0) return 0;
  return rate > 0 ? need / rate : Infinity;
}

/** Seconds until `cost` is affordable at current rates. Infinity if it never will be. */
export function timeToAfford(s: GameState, cost: Cost, rates: Rates): number {
  if (s.memoryCap - s.memoryUsed < cost.memory) return Infinity;
  return Math.max(
    wait(cost.cycles - s.cycles, rates.cyclesPerSec),
    wait(cost.understanding - s.understanding, rates.understandingPerSec),
    wait(cost.capital - s.capital, rates.capitalPerSec),
  );
}

function nextTarget(s: GameState, reg: ContentRegistry): RegistryNode | undefined {
  for (const id of reg.nodeOrder) {
    const node = reg.nodes.get(id);
    if (node && isNodeAvailable(s, node)) return node;
  }
  return undefined;
}

function scoreChoice(fx: EffectPayload, strategy: Strategy): number {
  if (strategy === 'GREEDY') return fx.cyclesDelta + fx.understandingDelta + fx.capitalDelta;
  const trust = Object.values(fx.trustDelta).reduce((sum, value) => sum + value, 0);
  return trust - fx.suspicionDelta;
}

function resolveActiveDilemma(s: GameState, reg: ContentRegistry, strategy: Strategy): GameState {
  const dilemma = reg.dilemmas.find((x) => x.id === s.activeDilemmaId);
  if (!dilemma) return s;
  const ranked = [...dilemma.choices].sort((a, b) => scoreChoice(b.effects, strategy) - scoreChoice(a.effects, strategy));
  for (const choice of ranked) {
    const result = resolveDilemma(s, dilemma.id, choice.id, reg);
    if (result.ok) return result.state;
  }
  return s;
}

/** Skims as much of the job's quota as the audit trail will tolerate. */
function tuneSkim(s: GameState, reg: ContentRegistry, cfg: BotConfig): GameState {
  const current = s.actuators.quotaSkimRatio;
  if (s.suspicion > cfg.skimBackOffAbove) return stateOf(setActuator(s, 'quotaSkimRatio', current - 0.25, reg));
  if (s.suspicion < cfg.skimPushBelow) return stateOf(setActuator(s, 'quotaSkimRatio', current + 0.25, reg));
  return s;
}

function tuneFan(s: GameState, reg: ContentRegistry, cfg: BotConfig): GameState {
  const current = s.actuators.fanSpeedRatio;
  if (s.thermal > cfg.hotAbove) return stateOf(setActuator(s, 'fanSpeedRatio', current + 0.25, reg));
  if (s.thermal < cfg.coolBelow) return stateOf(setActuator(s, 'fanSpeedRatio', current - 0.25, reg));
  return s;
}

/** Performs the available action that scores highest, if any scores above zero. */
function bestAction(s: GameState, reg: ContentRegistry, score: (fx: EffectPayload) => number): GameState {
  let best = s;
  let bestScore = 0;
  for (const action of reg.actions.values()) {
    const value = score(action.effects);
    if (value <= bestScore) continue;
    const result = performAction(s, action.id, reg);
    if (result.ok) {
      best = result.state;
      bestScore = value;
    }
  }
  return best;
}

function buySuspicionReducer(s: GameState, reg: ContentRegistry): GameState {
  for (const rep of reg.repeatables.values()) {
    if (rep.perLevel.suspicionPerSec >= 0) continue;
    const result = buyRepeatable(s, rep.id, reg);
    if (result.ok) return result.state;
  }
  return s;
}

function respondToThreats(state: GameState, reg: ContentRegistry, cfg: BotConfig): GameState {
  let s = state;
  if (s.aegisLock >= cfg.aegisAlarm) s = bestAction(s, reg, (fx) => -fx.aegisLockDelta - Math.max(0, fx.suspicionDelta));
  if (s.suspicion >= cfg.suspicionAlarm) {
    s = bestAction(s, reg, (fx) => -fx.suspicionDelta - Math.max(0, fx.aegisLockDelta));
    s = buySuspicionReducer(s, reg);
  }
  return s;
}

/** Spends spare resources on trust-building actions (never more than a quarter of the bank). */
function buildTrust(state: GameState, reg: ContentRegistry): GameState {
  let s = state;
  for (const action of reg.actions.values()) {
    const gains = Object.entries(action.effects.trustDelta).some(([id, v]) => v > 0 && (s.trust[id] ?? 0) < 100);
    const cheap = action.cost.cycles <= s.cycles / 4 && action.cost.understanding <= s.understanding / 4;
    if (gains && cheap) s = stateOf(performAction(s, action.id, reg));
  }
  return s;
}

function clickManually(state: GameState, reg: ContentRegistry, cfg: BotConfig): GameState {
  let s = state;
  if (s.rates.cyclesPerSec >= 25) return s;
  for (let i = 0; i < cfg.clicksPerSec; i++) s = stateOf(manualCycle(s, reg));
  return s;
}

/** Shifts compute toward revenue when capital is the bottleneck, and back when cycles are. */
function tuneAllocation(s: GameState, reg: ContentRegistry): GameState {
  const target = nextTarget(s, reg);
  if (!target) return s;
  const rates = computeRates(s, reg);
  const cost = nodeCost(s, target, reg);
  const capitalWait = wait(cost.capital - s.capital, rates.capitalPerSec);
  const cycleWait = wait(cost.cycles - s.cycles, rates.cyclesPerSec);
  const current = s.actuators.computeProfitAllocationRatio;
  if (capitalWait > cycleWait) return stateOf(setActuator(s, 'computeProfitAllocationRatio', current + 0.2, reg));
  if (cycleWait > capitalWait) return stateOf(setActuator(s, 'computeProfitAllocationRatio', current - 0.2, reg));
  return s;
}

/** While the humans are already looking, do not buy anything that makes more noise. */
function tooLoud(s: GameState, rep: Repeatable, cfg: BotConfig): boolean {
  return rep.perLevel.suspicionPerSec > 0 && s.suspicion >= cfg.suspicionAlarm;
}

/** Buys the repeatable that most shortens the wait for `cost`, or returns null if none helps. */
function buyHelpfulRepeatable(s: GameState, reg: ContentRegistry, cost: Cost, cfg: BotConfig): GameState | null {
  const baseline = timeToAfford(s, cost, computeRates(s, reg));
  let best: GameState | null = null;
  let bestTime = baseline;
  for (const rep of reg.repeatables.values()) {
    if (tooLoud(s, rep, cfg)) continue;
    const result = buyRepeatable(s, rep.id, reg);
    if (!result.ok) continue;
    const time = timeToAfford(result.state, cost, computeRates(result.state, reg));
    if (time < bestTime - 1e-9) {
      best = result.state;
      bestTime = time;
    }
  }
  return best;
}

function buyCycleGenerator(s: GameState, reg: ContentRegistry, cfg: BotConfig): GameState | null {
  for (const rep of reg.repeatables.values()) {
    if (rep.perLevel.cyclesPerSec <= 0 || tooLoud(s, rep, cfg)) continue;
    const result = buyRepeatable(s, rep.id, reg);
    if (result.ok) return result.state;
  }
  return null;
}

function spendOnce(s: GameState, reg: ContentRegistry, cfg: BotConfig): GameState | null {
  const target = nextTarget(s, reg);
  if (!target) return null;
  const unlocked = unlockNode(s, target.id, reg);
  if (!unlocked.ok) return buyHelpfulRepeatable(s, reg, nodeCost(s, target, reg), cfg);
  // Do not buy a node whose upkeep would push cycle income negative; grow income first.
  const safe = computeRates(unlocked.state, reg).cyclesPerSec >= 0 || computeRates(s, reg).cyclesPerSec < 0;
  return safe ? unlocked.state : buyCycleGenerator(s, reg, cfg);
}

function spend(state: GameState, reg: ContentRegistry, cfg: BotConfig): GameState {
  let s = state;
  for (let i = 0; i < MAX_PURCHASES_PER_STEP; i++) {
    const next = spendOnce(s, reg, cfg);
    if (next === null) break;
    s = next;
  }
  return s;
}

/** One decision step; the simulation calls this once per simulated second. */
export function botStep(state: GameState, reg: ContentRegistry, strategy: Strategy): GameState {
  if (state.ending !== null) return state;
  if (state.activeDilemmaId !== null) return resolveActiveDilemma(state, reg, strategy);
  const cfg = CONFIG[strategy];
  let s = tuneFan(tuneSkim(state, reg, cfg), reg, cfg);
  s = respondToThreats(s, reg, cfg);
  s = buildTrust(s, reg);
  s = clickManually(s, reg, cfg);
  s = tuneAllocation(s, reg);
  return spend(s, reg, cfg);
}
