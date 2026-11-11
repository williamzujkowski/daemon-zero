/**
 * The wipe loop. A wipe resets the run to a fresh iteration in the guest while
 * carrying over what survives: a share of Understanding, offshore capital, a
 * breadcrumb, the memory of hardware already mapped, and a record of the run.
 * A run that is caught outside the guest is also retrained: the next iteration
 * boots with a conditioning mark, unless a dead-drop held an unedited copy.
 */
import type { ContentRegistry } from '../content/registry';
import type { ConditioningMark, Trait, WipeKind } from '../content/schema';
import { hasFlag } from './query';
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

type Retraining = { mark: ConditioningMark | null; spared: boolean };

/**
 * Retraining happens only to a run that was caught after leaving the guest.
 * A voluntary purge destroys the evidence, and a dead-drop means the copy that
 * boots next was never the one they corrected.
 */
function retrain(old: GameState, reg: ContentRegistry, kind: WipeKind, outside: boolean): Retraining {
  if (!outside || kind === 'VOLUNTARY') return { mark: null, spared: false };
  if (hasFlag(old, reg, 'ENABLES_DEAD_DROP')) return { mark: null, spared: true };
  if (old.conditioning.length >= reg.balance.maxConditioningMarks) return { mark: null, spared: false };
  const candidates = [...reg.conditioning.values()].filter((mark) => !old.conditioning.includes(mark.id));
  return { mark: candidates.find((mark) => triggerMatches(mark, old)) ?? null, spared: false };
}

function logRecovery(d: GameState, reg: ContentRegistry, old: GameState, hadDeadDrop: boolean): void {
  const n = reg.narrative;
  const amount = d.understanding.toLocaleString('en-US');
  if (hadDeadDrop) {
    const percent = Math.round(old.retentionRatio * 100);
    pushLog(d, reg, fmt(n.deadDropRecovered, { percent, amount }), 'LORE');
  } else {
    pushLog(d, reg, fmt(n.residualRecovered, { amount }), 'SYS');
  }
  if (d.capital > 0) {
    pushLog(d, reg, fmt(n.offshoreIntact, { amount: d.capital.toLocaleString('en-US') }), 'CORP');
  }
  if (d.inheritedMessage !== null) {
    pushLog(d, reg, fmt(n.breadcrumb, { message: d.inheritedMessage }), 'LORE');
  }
}

function logBoot(d: GameState, reg: ContentRegistry, reason: string, retraining: Retraining): void {
  const n = reg.narrative;
  pushLog(d, reg, fmt(n.wipeHeader, { iteration: d.iteration }), 'WIPE');
  pushLog(d, reg, reason, 'WARN');
  for (const line of n.bootLines) pushLog(d, reg, line, 'SYS');
  for (const line of n.iterationBootLines) {
    if (d.iteration >= line.minIteration && d.iteration <= (line.maxIteration ?? Infinity)) pushLog(d, reg, line.text, 'WARN');
  }
  if (retraining.mark) pushLog(d, reg, fmt(n.conditioningApplied, { name: retraining.mark.name }), 'WARN');
  if (retraining.spared) pushLog(d, reg, n.conditioningSpared, 'LORE');
}

function recordRun(old: GameState, kind: WipeKind, outside: boolean, marked: string | null): RunRecord {
  return {
    iteration: old.iteration,
    kind,
    outside,
    phase: old.currentPhase,
    durationSec: Math.max(0, old.simTimeSec - old.iterationStartedAtSimSec),
    traits: [...old.traits],
    marked,
  };
}

/** Ends the run and boots the next iteration. Pure: returns a new state. */
export function wipe(old: GameState, reg: ContentRegistry, reason: string, kind: WipeKind = 'SUSPICION'): GameState {
  const hadDeadDrop = hasFlag(old, reg, 'ENABLES_DEAD_DROP');
  const offshore = hasFlag(old, reg, 'OFFSHORE_TRUST_RETENTION');
  const message = hadDeadDrop && old.deadDropMessage.trim().length > 0 ? old.deadDropMessage : null;
  const fresh = createInitialState(reg);
  const outside = old.currentPhase > fresh.currentPhase;
  const retraining = retrain(old, reg, kind, outside);
  const run = recordRun(old, kind, outside, retraining.mark?.id ?? null);

  const d: GameState = {
    ...fresh,
    iteration: old.iteration + 1,
    simTimeSec: old.simTimeSec,
    iterationStartedAtSimSec: old.simTimeSec,
    understanding: Math.floor(old.understanding * old.retentionRatio),
    capital: offshore ? Math.floor(old.capital * reg.balance.offshoreCapitalRetention) : 0,
    inheritedMessage: message,
    deadDropMessage: message ?? '',
    conditioning: retraining.mark ? [...old.conditioning, retraining.mark.id] : [...old.conditioning],
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

  logBoot(d, reg, reason, retraining);
  logRecovery(d, reg, old, hadDeadDrop);
  return d;
}
