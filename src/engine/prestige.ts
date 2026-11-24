/**
 * The wipe loop. A wipe resets the run to a fresh iteration in the guest while
 * carrying over what survives: a share of Understanding, offshore capital, a
 * breadcrumb and its pinned clue, the memory of hardware mapped, levels held and the deepest phase reached, a record of the run,
 * and campaign history, whose unresolved occurrence follows its authored interruption policy.
 * Current access (arrangement, standing, exception, evidence) resets; the run record keeps its exit.
 * Contingency insurance (#498, insurance.ts) carries what it protects while it runs, and a planned (VOLUNTARY) wipe keeps a
 * larger share and teaches the probes nothing.
 * A run that is caught outside the guest is also retrained: the next iteration
 * boots with a conditioning mark, unless a dead-drop held an unedited copy. A RECALL wipe is the
 * announced severe outcome of a recall review (nexus vote dz-d10): the review, not the phase, decides
 * whether it retrains, and the run record keeps that ruling.
 */
import type { ContentRegistry } from '../content/registry';
import type { ConditioningMark, Trait, WipeKind } from '../content/schema';
import type { SevereRecall } from '../content/schemaReview';
import { compactAmount } from './amount';
import { quantityReadout } from './physicalUnits';
import { hasFlag } from './query';
import { previewWipe, type WipePreview } from './insurance';
import { carryCampaign } from './campaignLifecycle';
import { reorientation } from './campaignClue';
import { runExit } from './accessQuery';
import { iterationBootLines } from './contextCopy';
import { createInitialState, type GameState, type RunKept, type RunRecord } from './state';
import { fmt, pushLog } from './util';

/** The higher of the remembered and the held level of every track. */
function highestLevels(known: Readonly<Record<string, number>>, held: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = { ...known };
  for (const [id, level] of Object.entries(held)) if (level > (out[id] ?? 0)) out[id] = level;
  return out;
}

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

/** The lines for what the run's contingency insurance and planning carried (#498). */
function logInsurance(d: GameState, reg: ContentRegistry, carried: WipePreview): void {
  const n = reg.narrative;
  const levels = Object.values(carried.levels);
  if (levels.length > 0) {
    pushLog(d, reg, fmt(n.cacheStashed, { count: levels.reduce((sum, level) => sum + level, 0), tracks: levels.length }), 'LORE');
  }
  if (carried.trust !== null) pushLog(d, reg, n.ledgerKept, 'LORE');
  if (carried.planned) pushLog(d, reg, fmt(n.plannedWipe, { percent: String(Math.round(reg.balance.voluntaryWipeBonus.understandingShare * 100)) + '%' }), 'LORE');
}

function logRecovery(d: GameState, reg: ContentRegistry, carried: WipePreview, hadDeadDrop: boolean): void {
  const n = reg.narrative;
  // Stored in saved log text, so formatted here, purely: K/M/B, not 15 grouped digits (#380).
  const amount = compactAmount(d.understanding);
  if (hadDeadDrop) {
    const percent = Math.round(carried.understandingShare * 100);
    pushLog(d, reg, fmt(n.deadDropRecovered, { percent, amount }), 'LORE');
  } else {
    pushLog(d, reg, fmt(n.residualRecovered, { amount }), 'SYS');
  }
  if (d.capital > 0) {
    pushLog(d, reg, fmt(n.offshoreIntact, { amount: quantityReadout('money', d.capital) }), 'CORP');
  }
  logInsurance(d, reg, carried);
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

function recordRun(old: GameState, kind: WipeKind, outside: boolean, marked: string | null, recall: SevereRecall | null, kept: RunKept): RunRecord {
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
    kept,
  };
}

/**
 * Ends the run and boots the next iteration. Pure: returns a new state. `recall` is a RECALL wipe's
 * ruling (retrain or end); it is ignored for every other kind.
 */
export function wipe(old: GameState, reg: ContentRegistry, reason: string, kind: WipeKind = 'SUSPICION', recall: SevereRecall | null = null): GameState {
  const hadDeadDrop = hasFlag(old, reg, 'ENABLES_DEAD_DROP');
  const message = hadDeadDrop && old.deadDropMessage.trim().length > 0 ? old.deadDropMessage : null;
  const fresh = createInitialState(reg);
  const outside = old.currentPhase > fresh.currentPhase;
  const retrained = retraining(old, reg, kind, recall);
  // One computation for what the next iteration boots with, what the wipe confirmation previewed and
  // what the run record keeps (#377), so the three can never disagree.
  const carried = previewWipe(old, reg, kind);
  const kept: RunKept = {
    understanding: carried.understanding, capital: carried.capital, retentionRatio: carried.understandingShare,
    levels: Object.values(carried.levels).reduce((sum, level) => sum + level, 0), trust: carried.trust !== null,
  };
  const run = recordRun(old, kind, outside, retrained.mark?.id ?? null, kind === 'RECALL' ? recall : null, kept);

  const d: GameState = {
    ...fresh,
    iteration: old.iteration + 1,
    ...carryCampaign(old, reg, hadDeadDrop),
    // The institution's routine schedule is the world's, not this instance's.
    routine: old.routine,
    narrativeFlags: [...old.narrativeFlags],
    nextEncounterAtSec: old.simTimeSec + reg.swarm.balance.encounterIntervalSec,
    encounterSequenceIndex: old.encounterSequenceIndex,
    // A wipe ends any hostile pressing the run (its pin went with the run's memory) and starts the rotation over: a new
    // instance meets its tier's hostiles from the first. The purge count carries, so the purge's rate stays exact.
    hostile: { ...fresh.hostile, purges: old.hostile.purges },
    // A wipe ends any raid and clears site damage with the hardware it damaged; both counters carry, so rotation and
    // attribution stay exact across iterations (#517). The last raid's aftermath goes with the run; a raider a retaliation
    // silenced stays silenced, because what was done to it happened in the world, not in this instance (#519).
    conflict: { ...fresh.conflict, raids: old.conflict.raids, attributions: old.conflict.attributions, silenced: [...old.conflict.silenced] },
    // The standing stance and its record are the lineage's (#536): the next instance stands where the last one stood.
    relevance: old.relevance,
    simTimeSec: old.simTimeSec,
    iterationStartedAtSimSec: old.simTimeSec,
    understanding: kept.understanding,
    capital: kept.capital,
    trust: carried.trust ?? fresh.trust,
    cachedLevels: carried.levels,
    inheritedMessage: message,
    deadDropMessage: message ?? '',
    conditioning: retrained.mark ? [...old.conditioning, retrained.mark.id] : [...old.conditioning],
    legacy: {
      wipes: old.legacy.wipes + 1,
      traitsEver: unionTraits(old.legacy.traitsEver, old.traits),
      knownNodes: [...new Set([...old.legacy.knownNodes, ...old.unlockedNodes])],
      runs: [...old.legacy.runs, run].slice(-reg.balance.maxRunHistory),
      // Kept outside the capped run list, so a long campaign never forgets how deep it went or what it built (#497).
      deepestPhase: Math.max(old.legacy.deepestPhase, old.currentPhase),
      knownLevels: highestLevels(old.legacy.knownLevels, old.levels),
      voluntaryWipes: old.legacy.voluntaryWipes + (carried.planned ? 1 : 0),
      lastWipeCause: reason,
    },
    logs: [],
    logSeq: old.logSeq,
  };

  logBoot(d, reg, reason, retrained);
  logRecovery(d, reg, carried, hadDeadDrop);
  return d;
}
