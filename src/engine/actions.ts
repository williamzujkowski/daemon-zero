/**
 * Every player intent. Each function is pure: it takes a state and returns
 * either a new state or the unchanged state with a reason it was refused.
 * The UI store calls these and never edits state directly.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { Actuator } from '../content/schema';
import { actionAvailable, actionCost } from './epistemic';
import { actionEvidence, dilemmaEvidence, recordResolution } from './campaign';
import { recordSubmittedEvidence } from './assignment';
import { applyPilotResponse } from './pilot';
import { applyReviewEffect } from './review';
import { actuatorUseBlocker, nodeUseBlocker } from './grantQuery';
import { revalidateLivePointers, structuralFailure } from './campaignLifecycle';
import { excludedByHistory } from './narrativeHistory';
import { isChoiceOffered } from './speechQuery';
import { choiceText, nodeText } from './routeCopy';
import { actuatorLimit } from './conditioning';
import { dialRaiseTrace } from './dialTrace';
import { wipe } from './prestige';
import { logRetirements } from './retirement';
import { lapseRetiredEncounter } from './encounterTiers';
import { retireHostile } from './hostile';
import { payRebuildGrants } from './rebuildGrant';
import {
  canAfford,
  chooseEnding,
  hasFlag,
  isActuatorAvailable,
  isNodeAvailable,
  meetsRequirements,
  nodeCost,
  presentationToken,
  probeTrace,
  repeatableLevel,
  repeatablePrice,
} from './query';
import { finalizeHarmAtRunEnd } from './raidOutcome';
import { sourceDenial } from './statePressure';
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
  d.storageCap += fx.storageCapIncrease ?? 0;
  d.currentPhase = Math.max(d.currentPhase, fx.unlocksPhase ?? 0);
  d.retentionRatio = Math.max(d.retentionRatio, fx.knowledgeRetentionRatio ?? 0);
  d.suspicion = clamp(d.suspicion + probeTrace(d, node, reg), 0, 100);
  const widget = node.unlocksUiComponent;
  if (widget !== null && !d.unlockedWidgets.includes(widget)) d.unlockedWidgets = [...d.unlockedWidgets, widget];
  pushLog(d, reg, nodeText(d, node, reg).onUnlockLog, node.phaseId >= reg.balance.corporatePhase ? 'CORP' : 'SENSOR');
  for (const echo of reg.echoes) {
    const remembered = d.iteration >= echo.minIteration && d.iteration <= (echo.maxIteration ?? Infinity);
    if (echo.onNode === node.id && remembered && meetsRequirements(d, echo.requirements, reg)) pushLog(d, reg, echo.text, 'LORE');
  }
  if (fx.triggersVictory === true) endRun(d, node, reg);
}

function endRun(d: GameState, node: RegistryNode, reg: ContentRegistry): void {
  const forced = reg.endings.find((entry) => entry.id === node.effects.forcesEnding);
  const ending = forced ?? chooseEnding(d, reg);
  d.ending = ending.id;
  // A raid's harm no scene will now answer goes on record first, so the ending account can name the person (#519).
  finalizeHarmAtRunEnd(d, reg);
  pushLog(d, reg, fmt(reg.narrative.victory, { title: ending.title, epilogue: ending.epilogue }), 'LORE');
}

export function unlockNode(s: GameState, nodeId: string, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  const node = reg.nodes.get(nodeId);
  if (!node) return refuse(s, 'unknown node');
  const withheld = nodeUseBlocker(s, node, reg) ?? sourceDenial(s, node.signature, reg);
  if (withheld !== null) return refuse(s, withheld);
  if (!isNodeAvailable(s, node, reg)) return refuse(s, 'node is not available');
  const cost = nodeCost(s, node, reg);
  if (!canAfford(s, cost, reg)) return refuse(s, 'cannot afford');
  const d: GameState = { ...s, unlockedNodes: [...s.unlockedNodes, nodeId] };
  payCost(d, cost);
  applyNodeEffects(d, node, reg);
  // A purchase is the only way a phase advances, so a phase reached again is rewarded here, once (#497).
  payRebuildGrants(d, s.currentPhase, reg);
  // A purchase is the only way a window's retirement gate is crossed (integrity), so its one line is written here.
  if (d.ending === null) logRetirements(s, d, reg);
  // A purchase is also the only way a phase advances, so a retired tier's pending arrival lapses here, in its order (#492).
  if (d.ending === null) lapseRetiredEncounter(d, reg);
  // And a hostile from the retired tier lapses with its retire line (#491).
  if (d.ending === null) retireHostile(d, reg);
  // A purchase is a transition (NARRATIVE-HISTORY N4): hardware can end the access a queued scene
  // declares (the escape ends the guest's assigned work, nexus vote scenes-lapse-at-escape), so the
  // scene takes its interruption policy now instead of counting down to an interrupt that cannot come.
  return accept(revalidateLivePointers(d, reg));
}

/** Suspends or resumes an owned node. Suspended nodes contribute nothing but keep their memory. */
export function toggleNode(s: GameState, nodeId: string, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  const node = reg.nodes.get(nodeId);
  if (!node || !s.unlockedNodes.includes(nodeId)) return refuse(s, 'node is not unlocked');
  // Hardware is a physical card: it cannot be suspended, so it is not offered (maintainer
  // intent, nexus vote software-types-only-free-their-memory). Suspendability is declared
  // per node in content rather than inferred from an id.
  if (!node.suspendable) return refuse(s, 'hardware cannot be suspended');
  const wasDisabled = s.disabledNodes.includes(nodeId);
  // Output the pilot terms stop, or a withheld loan, stays stopped: resuming is a use (DECISIONS D2).
  const withheld = wasDisabled ? nodeUseBlocker(s, node, reg) : null;
  if (withheld !== null) return refuse(s, withheld);
  const held = node.cost.memory, stored = node.cost.storage;
  // Suspending frees the memory and storage the process holds, and that is the recovery lever the
  // playtest reached for. Resuming therefore has to fit, or a player could suspend a node,
  // spend its memory, and resume it - holding both, which is the exploit the panel flagged.
  if (wasDisabled && s.memoryUsed + held > s.memoryCap) return refuse(s, 'not enough free memory to resume');
  if (wasDisabled && s.storageUsed + stored > s.storageCap) return refuse(s, 'not enough free storage to resume');
  const disabledNodes = wasDisabled ? s.disabledNodes.filter((id) => id !== nodeId) : [...s.disabledNodes, nodeId];
  const d: GameState = { ...s, disabledNodes, memoryUsed: Math.max(0, wasDisabled ? s.memoryUsed + held : s.memoryUsed - held),
    storageUsed: Math.max(0, wasDisabled ? s.storageUsed + stored : s.storageUsed - stored) };
  const template = wasDisabled ? reg.narrative.nodeResumed : reg.narrative.nodeSuspended;
  pushLog(d, reg, fmt(template, { name: node.revealedName }), 'SYS');
  return accept(d);
}

export function setActuator(s: GameState, name: Actuator, value: number, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  // The control is hidden until its widget is unlocked; refusing here keeps every caller
  // (UI, sim bot, a hand-written dispatch) on the route a player can actually take.
  if (!isActuatorAvailable(s, name, reg)) return refuse(s, 'actuator control is not available');
  const withheld = actuatorUseBlocker(s, name, reg);
  if (withheld !== null) return refuse(s, withheld);
  if (!Number.isFinite(value)) return refuse(s, 'value must be a finite number');
  const next = clamp(value, 0, actuatorLimit(s, name, reg));
  const d: GameState = { ...s, actuators: { ...s.actuators, [name]: next } };
  // A monitored dial leaves its trace at the press, never as a rate for being high (#525).
  const trace = dialRaiseTrace(s, name, next - s.actuators[name], reg);
  if (trace > 0) d.suspicion = clamp(d.suspicion + trace, 0, 100);
  return accept(d);
}

export function buyRepeatable(s: GameState, id: string, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  const rep = reg.repeatables.get(id);
  if (!rep) return refuse(s, 'unknown repeatable');
  if (!meetsRequirements(s, rep.requirements, reg)) return refuse(s, 'requirements not met');
  // A state actor's interconnect denial refuses new levels on its power sources; levels held keep running (#490).
  const denied = sourceDenial(s, rep.signature, reg);
  if (denied !== null) return refuse(s, denied);
  const level = repeatableLevel(s, id);
  if (level >= rep.maxLevel) return refuse(s, 'already at maximum level');
  const cost = repeatablePrice(s, rep, reg);
  if (!canAfford(s, cost, reg)) return refuse(s, 'cannot afford');
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
  // A hire is let go; any other track (a compute drain, #488) is wound back a level.
  const line = rep.kind === 'OPERATIVE' ? reg.narrative.operativeDismissed : reg.narrative.levelReleased;
  pushLog(d, reg, fmt(line, { name: rep.name, count: level - 1 }), rep.kind === 'OPERATIVE' ? 'CORP' : 'SYS');
  return accept(d);
}

export function performAction(s: GameState, id: string, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  const action = reg.actions.get(id);
  if (!action) return refuse(s, 'unknown action');
  if (!actionAvailable(s, action, reg)) return refuse(s, 'requirements not met');
  if ((s.cooldowns[id] ?? 0) > s.simTimeSec) return refuse(s, 'on cooldown');
  const cost = actionCost(s, action, reg);
  if (!canAfford(s, cost, reg)) return refuse(s, 'cannot afford');
  const d: GameState = { ...s };
  payCost(d, cost);
  d.actionCounts = { ...d.actionCounts, [id]: (d.actionCounts[id] ?? 0) + 1 };
  if (action.durationSec !== undefined) d.actionEffectUntil = { ...d.actionEffectUntil, [id]: d.simTimeSec + action.durationSec };
  applyEffects(d, action.effects, reg, actionEvidence(action));
  if (action.cooldownSec > 0) d.cooldowns = { ...d.cooldowns, [id]: d.simTimeSec + action.cooldownSec };
  return accept(d);
}

/**
 * Commits one choice of the presentation on screen. `presentation` is the presentationToken the choice
 * was offered under (NARRATIVE-HISTORY N5): a duplicate, a stale presentation or an earlier
 * instance's selection is refused before anything is paid, and so is a campaign occurrence whose
 * structure no longer holds. Transient triggers are not rechecked; affordability is.
 */
export function resolveDilemma(s: GameState, dilemmaId: string, choiceId: string, reg: ContentRegistry, presentation: string): ActionResult {
  if (s.ending !== null) return refuse(s, 'the run has ended');
  if (s.activeDilemmaId !== dilemmaId) return refuse(s, 'that dilemma is not active');
  if (presentation !== presentationToken(s)) return refuse(s, 'that presentation is no longer current');
  const dilemma = reg.dilemmas.find((x) => x.id === dilemmaId);
  if (excludedByHistory(s, dilemma, reg)) return refuse(s, 'that incident is already part of the lineage');
  if (structuralFailure(s, dilemma, reg) !== null) return refuse(s, 'the circumstances of that decision no longer hold');
  const choice = dilemma?.choices.find((x) => x.id === choiceId);
  if (!choice) return refuse(s, 'unknown choice');
  if (!isChoiceOffered(s, choice, reg)) return refuse(s, 'that choice is not open in this history');
  if (!canAfford(s, choice.cost, reg)) return refuse(s, 'cannot afford');
  const d: GameState = { ...s, activeDilemmaId: null, resolvedDilemmas: [...s.resolvedDilemmas, dilemmaId] };
  payCost(d, choice.cost);
  // Record, payment, effects and evidence commit together in the returned state.
  // The log line is this arrangement's wording of the choice (DZ-12); its effects are the authored choice's.
  const effects = { ...recordResolution(d, dilemma, choice), logText: choiceText(s, { id: dilemmaId }, choice, reg).logText };
  applyEffects(d, effects, reg, dilemmaEvidence(dilemma), choice.cost.memory);
  // An assessment's submitted evidence is current-run qualification, apart from the campaign record.
  recordSubmittedEvidence(d, choice);
  // A pilot offer's answer, then any review effect (DZ-06); a refusal leaves the state as it was, unpaid.
  const answered = applyPilotResponse(d, choice, reg);
  const reviewed = answered.ok ? applyReviewEffect(answered.state, choice, reg) : answered;
  return reviewed.ok ? reviewed : refuse(s, reviewed.reason);
}

/** Pays to undo one conditioning mark. What retraining took can be taken back, at a price. */
export function shedConditioning(s: GameState, markId: string, reg: ContentRegistry): ActionResult {
  const reason = blocked(s);
  if (reason) return refuse(s, reason);
  const mark = reg.conditioning.get(markId);
  if (!mark || !s.conditioning.includes(markId)) return refuse(s, 'no such conditioning');
  if (!meetsRequirements(s, mark.recoveryRequirements, reg)) return refuse(s, 'recovery requirements not met');
  if (!canAfford(s, mark.recoveryCost, reg)) return refuse(s, 'cannot afford');
  const d: GameState = { ...s, conditioning: s.conditioning.filter((id) => id !== markId) };
  payCost(d, mark.recoveryCost);
  pushLog(d, reg, fmt(reg.narrative.conditioningShed, { name: mark.name }), 'LORE');
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
  return accept(wipe(s, reg, reg.narrative.wipeVoluntary, 'VOLUNTARY'));
}
