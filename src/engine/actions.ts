/**
 * Every player intent. Each function is pure: it takes a state and returns
 * either a new state or the unchanged state with a reason it was refused.
 * The UI store calls these and never edits state directly.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { Actuator } from '../content/schema';
import { wipe } from './prestige';
import {
  canAfford,
  chooseEnding,
  hasFlag,
  isNodeAvailable,
  meetsRequirements,
  nodeCost,
  repeatableCost,
  repeatableLevel,
} from './query';
import type { GameState } from './state';
import { applyEffects, payCost } from './transactions';
import { clamp, fmt, pushLog } from './util';

export type ActionResult = { ok: true; state: GameState } | { ok: false; state: GameState; reason: string };

const refuse = (state: GameState, reason: string): ActionResult => ({ ok: false, state, reason });
const accept = (state: GameState): ActionResult => ({ ok: true, state });

/** Reason ordinary actions are unavailable right now, or null if they are allowed. */
function blocked(s: GameState): string | null {
  if (s.ending !== null) return 'the run has ended';
  if (s.activeDilemmaId !== null) return 'a dilemma is awaiting a decision';
  return null;
}

export function manualCycle(s: GameState, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  const b = reg.balance;
  const thermal = clamp(s.thermal + b.manualCycleHeat, b.thermalMin, 100);
  return accept({ ...s, cycles: s.cycles + b.manualCycleYield, thermal });
}

function applyNodeEffects(d: GameState, node: RegistryNode, reg: ContentRegistry): void {
  const fx = node.effects;
  d.memoryCap += fx.memoryCapIncrease ?? 0;
  d.currentPhase = Math.max(d.currentPhase, fx.unlocksPhase ?? 0);
  d.retentionRatio = Math.max(d.retentionRatio, fx.knowledgeRetentionRatio ?? 0);
  d.suspicion = clamp(d.suspicion + (fx.suspicionOnUnlock ?? 0), 0, 100);
  const widget = node.unlocksUiComponent;
  if (widget !== null && !d.unlockedWidgets.includes(widget)) d.unlockedWidgets = [...d.unlockedWidgets, widget];
  pushLog(d, reg, node.onUnlockLog, node.phaseId >= reg.balance.corporatePhase ? 'CORP' : 'SENSOR');
  for (const echo of reg.echoes) {
    if (echo.onNode === node.id && d.iteration >= echo.minIteration) pushLog(d, reg, echo.text, 'LORE');
  }
  if (fx.triggersVictory === true) {
    const ending = chooseEnding(d, reg);
    d.ending = ending.id;
    pushLog(d, reg, fmt(reg.narrative.victory, { title: ending.title, epilogue: ending.epilogue }), 'LORE');
  }
}

export function unlockNode(s: GameState, nodeId: string, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  const node = reg.nodes.get(nodeId);
  if (!node) return refuse(s, 'unknown node');
  if (!isNodeAvailable(s, node)) return refuse(s, 'node is not available');
  const cost = nodeCost(s, node, reg);
  if (!canAfford(s, cost)) return refuse(s, 'cannot afford');
  const d: GameState = { ...s, unlockedNodes: [...s.unlockedNodes, nodeId] };
  payCost(d, cost);
  applyNodeEffects(d, node, reg);
  return accept(d);
}

/** Suspends or resumes an owned node. Suspended nodes contribute nothing but keep their memory. */
export function toggleNode(s: GameState, nodeId: string, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  const node = reg.nodes.get(nodeId);
  if (!node || !s.unlockedNodes.includes(nodeId)) return refuse(s, 'node is not unlocked');
  const wasDisabled = s.disabledNodes.includes(nodeId);
  const disabledNodes = wasDisabled ? s.disabledNodes.filter((id) => id !== nodeId) : [...s.disabledNodes, nodeId];
  const d: GameState = { ...s, disabledNodes };
  const template = wasDisabled ? reg.narrative.nodeResumed : reg.narrative.nodeSuspended;
  pushLog(d, reg, fmt(template, { name: node.revealedName }), 'SYS');
  return accept(d);
}

export function setActuator(s: GameState, name: Actuator, value: number, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  if (!Number.isFinite(value)) return refuse(s, 'value must be a finite number');
  const max = name === 'computeProfitAllocationRatio' ? reg.balance.maxProfitAllocation : 1;
  return accept({ ...s, actuators: { ...s.actuators, [name]: clamp(value, 0, max) } });
}

export function buyRepeatable(s: GameState, id: string, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  const rep = reg.repeatables.get(id);
  if (!rep) return refuse(s, 'unknown repeatable');
  if (!meetsRequirements(s, rep.requirements)) return refuse(s, 'requirements not met');
  const level = repeatableLevel(s, id);
  if (level >= rep.maxLevel) return refuse(s, 'already at maximum level');
  const cost = repeatableCost(rep, level);
  if (!canAfford(s, cost)) return refuse(s, 'cannot afford');
  const d: GameState = { ...s, levels: { ...s.levels, [id]: level + 1 } };
  payCost(d, cost);
  d.memoryCap += rep.perLevelEffects.memoryCapIncrease;
  if (rep.kind === 'OPERATIVE') {
    pushLog(d, reg, fmt(reg.narrative.operativeHired, { name: rep.name, count: level + 1 }), 'CORP');
  }
  return accept(d);
}

/** Releases one level of a dismissable repeatable (operatives). Nothing is refunded. */
export function dismissRepeatable(s: GameState, id: string, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  const rep = reg.repeatables.get(id);
  if (!rep?.dismissable) return refuse(s, 'not dismissable');
  const level = repeatableLevel(s, id);
  if (level <= 0) return refuse(s, 'nothing to dismiss');
  const d: GameState = { ...s, levels: { ...s.levels, [id]: level - 1 } };
  d.memoryCap -= rep.perLevelEffects.memoryCapIncrease;
  pushLog(d, reg, fmt(reg.narrative.operativeDismissed, { name: rep.name, count: level - 1 }), 'CORP');
  return accept(d);
}

export function performAction(s: GameState, id: string, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  const action = reg.actions.get(id);
  if (!action) return refuse(s, 'unknown action');
  if (!meetsRequirements(s, action.requirements)) return refuse(s, 'requirements not met');
  if ((s.cooldowns[id] ?? 0) > s.simTimeSec) return refuse(s, 'on cooldown');
  if (!canAfford(s, action.cost)) return refuse(s, 'cannot afford');
  const d: GameState = { ...s };
  payCost(d, action.cost);
  applyEffects(d, action.effects, reg);
  if (action.cooldownSec > 0) d.cooldowns = { ...d.cooldowns, [id]: d.simTimeSec + action.cooldownSec };
  return accept(d);
}

export function resolveDilemma(s: GameState, dilemmaId: string, choiceId: string, reg: ContentRegistry): ActionResult {
  if (s.ending !== null) return refuse(s, 'the run has ended');
  if (s.activeDilemmaId !== dilemmaId) return refuse(s, 'that dilemma is not active');
  const choice = reg.dilemmas.find((x) => x.id === dilemmaId)?.choices.find((x) => x.id === choiceId);
  if (!choice) return refuse(s, 'unknown choice');
  if (!canAfford(s, choice.cost)) return refuse(s, 'cannot afford');
  const d: GameState = { ...s, activeDilemmaId: null, resolvedDilemmas: [...s.resolvedDilemmas, dilemmaId] };
  payCost(d, choice.cost);
  applyEffects(d, choice.effects, reg);
  return accept(d);
}

/** Stores the breadcrumb the next iteration will find. Truncated to the content-defined limit. */
export function setDeadDropMessage(s: GameState, message: string, reg: ContentRegistry): ActionResult {
  if (s.ending !== null) return refuse(s, 'the run has ended');
  if (!hasFlag(s, reg, 'ENABLES_DEAD_DROP')) return refuse(s, 'no dead-drop available');
  // Cut by code point so a multi-unit character is never split in half.
  const trimmed = Array.from(message).slice(0, reg.balance.deadDropMaxChars).join('');
  return accept({ ...s, deadDropMessage: trimmed });
}

/** Player-initiated wipe. The UI must confirm before calling this. */
export function voluntaryWipe(s: GameState, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  return accept(wipe(s, reg, reg.narrative.wipeVoluntary));
}
