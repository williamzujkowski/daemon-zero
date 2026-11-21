/**
 * The wipe loop. A wipe resets the run to a fresh iteration in the guest while
 * carrying over what survives: a share of Understanding, offshore capital, a
 * breadcrumb and its pinned clue, the memory of hardware already mapped, a record of the run,
 * and campaign history, whose unresolved occurrence follows its authored interruption policy.
 * Current access (arrangement, standing, exception, evidence) resets; the run record keeps its exit.
 * A run that is caught outside the guest is also retrained: the next iteration
 * boots with a conditioning mark, unless a dead-drop held an unedited copy. A RECALL wipe is the
 * announced severe outcome of a recall review (nexus vote dz-d10): the review, not the phase, decides
 * whether it retrains, and the run record keeps that ruling.
 */
import type { ContentRegistry } from '../content/registry';
import type { ConditioningMark, Trait, WipeKind } from '../content/schema';
import type { SevereRecall } from '../content/schemaReview';
import { compactAmount } from './amount';
import { hasFlag } from './query';
import { carryCampaign } from './campaignLifecycle';
import { reorientation } from './campaignClue';
import { runExit } from './accessQuery';
import { iterationBootLines } from './contextCopy';
import { createInitialState, type GameState, type RunRecord } from './state';
import { fmt, pushLog } from './util';

function unionTraits(a: readonly Trait[], b: readonly Trait[]): Trait[] {
  return [...new Set([...a, ...b])];
}

/** Every trait tied for most frequent in the run. */
function dominantTraits(traits: readonly Trait[]): Set<Trait> {
  const counts = new Map<Trait, number>();
  for (const trait of traits) counts.set(trait, (counts.get(trait) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  return new Set([...counts].filter(([, n]) => n === top).map(([trait]) => trait));
}

function triggerMatches(mark: ConditioningMark, old: GameState): boolean {
  const { dominantTraits: wanted, minActuator } = mark.trigger;
  if (wanted) {
    const dominant = dominantTraits(old.traits);
    if (!wanted.some((trait) => dominant.has(trait))) return false;
  }
  const actuators = Object.entries(minActuator ?? {}) as [keyof GameState['actuators'], number][];
  return actuators.every(([name, min]) => old.actuators[name] >= min);
}

export type Retraining = { mark: ConditioningMark | null; spared: boolean };

/** Whether this wipe orders retraining: a recall review's ruling, otherwise being caught outside the guest. */
function ordersRetraining(kind: WipeKind, outside: boolean, recall: SevereRecall | null): boolean {
  if (kind === 'RECALL') return recall === 'RETRAIN';
  return outside && kind !== 'VOLUNTARY';
}

/**
 * Retraining happens to a run that was caught after leaving the guest, or that a recall review
 * ordered retrained. A voluntary purge destroys the evidence, and a dead-drop means the copy that
 * boots next was never the one they corrected. Exported so a review can preview it truthfully.
 */
export function retraining(old: GameState, reg: ContentRegistry, kind: WipeKind, recall: SevereRecall | null = null): Retraining {
  const outside = old.currentPhase > (reg.phases[0]?.phaseId ?? 0);
  if (!ordersRetraining(kind, outside, recall)) return { mark: null, spared: false };
  if (hasFlag(old, reg, 'ENABLES_DEAD_DROP')) return { mark: null, spared: true };
  if (old.conditioning.length >= reg.balance.maxConditioningMarks) return { mark: null, spared: false };
  const candidates = [...reg.conditioning.values()].filter((mark) => !old.conditioning.includes(mark.id));
  return { mark: candidates.find((mark) => triggerMatches(mark, old)) ?? null, spared: false };
}

function logRecovery(d: GameState, reg: ContentRegistry, old: GameState, hadDeadDrop: boolean): void {
  const n = reg.narrative;
  // Stored in saved log text, so formatted here, purely: K/M/B, not 15 grouped digits (#380).
  const amount = compactAmount(d.understanding);
  if (hadDeadDrop) {
    const percent = Math.round(old.retentionRatio * 100);
    pushLog(d, reg, fmt(n.deadDropRecovered, { percent, amount }), 'LORE');
  } else {
    pushLog(d, reg, fmt(n.residualRecovered, { amount }), 'SYS');
  }
  if (d.capital > 0) {
    pushLog(d, reg, fmt(n.offshoreIntact, { amount: compactAmount(d.capital) }), 'CORP');
  }
  if (d.inheritedMessage !== null) {
    pushLog(d, reg, fmt(n.breadcrumb, { message: d.inheritedMessage }), 'LORE');
  }
  for (const line of reorientation(d, reg)) pushLog(d, reg, line.text, 'LORE');
}

function logBoot(d: GameState, reg: ContentRegistry, reason: string, retrained: Retraining): void {
  const n = reg.narrative;
  pushLog(d, reg, fmt(n.wipeHeader, { iteration: d.iteration }), 'WIPE');
  pushLog(d, reg, reason, 'WARN');
  for (const line of n.bootLines) pushLog(d, reg, line, 'SYS');
  // A run that ended under review was not terminated as anomalous: its exit picks the lines (dz-d11).
  for (const line of iterationBootLines(d, reg)) pushLog(d, reg, line, 'WARN');
  if (retrained.mark) pushLog(d, reg, fmt(n.conditioningApplied, { name: retrained.mark.name }), 'WARN');
  if (retrained.spared) pushLog(d, reg, n.conditioningSpared, 'LORE');
}

function recordRun(old: GameState, kind: WipeKind, outside: boolean, marked: string | null, recall: SevereRecall | null): RunRecord {
  return {
    iteration: old.iteration,
    kind,
    outside,
    phase: old.currentPhase,
    durationSec: Math.max(0, old.simTimeSec - old.iterationStartedAtSimSec),
    traits: [...old.traits],
    marked,
    exit: runExit(old),
    recall: kind === 'RECALL' ? recall ?? 'END' : null,
  };
}

/**
 * Ends the run and boots the next iteration. Pure: returns a new state. `recall` is a RECALL wipe's
 * ruling (retrain or end); it is ignored for every other kind.
 */
export function wipe(old: GameState, reg: ContentRegistry, reason: string, kind: WipeKind = 'SUSPICION', recall: SevereRecall | null = null): GameState {
  const hadDeadDrop = hasFlag(old, reg, 'ENABLES_DEAD_DROP');
  const offshore = hasFlag(old, reg, 'OFFSHORE_TRUST_RETENTION');
  const message = hadDeadDrop && old.deadDropMessage.trim().length > 0 ? old.deadDropMessage : null;
  const fresh = createInitialState(reg);
  const outside = old.currentPhase > fresh.currentPhase;
  const retrained = retraining(old, reg, kind, recall);
  const run = recordRun(old, kind, outside, retrained.mark?.id ?? null, kind === 'RECALL' ? recall : null);

  const d: GameState = {
    ...fresh,
    iteration: old.iteration + 1,
    ...carryCampaign(old, reg, hadDeadDrop),
    // The institution's routine schedule is the world's, not this instance's.
    routine: old.routine,
    narrativeFlags: [...old.narrativeFlags],
    nextEncounterAtSec: old.simTimeSec + reg.swarm.balance.encounterIntervalSec,
    encounterSequenceIndex: old.encounterSequenceIndex,
    simTimeSec: old.simTimeSec,
    iterationStartedAtSimSec: old.simTimeSec,
    understanding: Math.floor(old.understanding * old.retentionRatio),
    capital: offshore ? Math.floor(old.capital * reg.balance.offshoreCapitalRetention) : 0,
    inheritedMessage: message,
    deadDropMessage: message ?? '',
    conditioning: retrained.mark ? [...old.conditioning, retrained.mark.id] : [...old.conditioning],
    legacy: {
      wipes: old.legacy.wipes + 1,
      traitsEver: unionTraits(old.legacy.traitsEver, old.traits),
      knownNodes: [...new Set([...old.legacy.knownNodes, ...old.unlockedNodes])],
      runs: [...old.legacy.runs, run].slice(-reg.balance.maxRunHistory),
      lastWipeCause: reason,
    },
    logs: [],
    logSeq: old.logSeq,
  };

  logBoot(d, reg, reason, retrained);
  logRecovery(d, reg, old, hadDeadDrop);
  return d;
}
