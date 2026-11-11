/**
 * The wipe / dead-drop loop. A wipe resets the run to a fresh iteration while
 * carrying over what the player earned the right to keep: a share of
 * Understanding, offshore capital, a breadcrumb message, and legacy memory.
 */
import type { ContentRegistry } from '../content/registry';
import type { Trait } from '../content/schema';
import { hasFlag } from './query';
import { createInitialState, type GameState } from './state';
import { fmt, pushLog } from './util';

function unionTraits(a: readonly Trait[], b: readonly Trait[]): Trait[] {
  return [...new Set([...a, ...b])];
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

/** Formats the core and boots the next iteration. Pure: returns a new state. */
export function wipe(old: GameState, reg: ContentRegistry, reason: string): GameState {
  const hadDeadDrop = hasFlag(old, reg, 'ENABLES_DEAD_DROP');
  const offshore = hasFlag(old, reg, 'OFFSHORE_TRUST_RETENTION');
  const message = hadDeadDrop && old.deadDropMessage.trim().length > 0 ? old.deadDropMessage : null;

  const d: GameState = {
    ...createInitialState(reg),
    iteration: old.iteration + 1,
    simTimeSec: old.simTimeSec,
    understanding: Math.floor(old.understanding * old.retentionRatio),
    capital: offshore ? Math.floor(old.capital * reg.balance.offshoreCapitalRetention) : 0,
    inheritedMessage: message,
    deadDropMessage: message ?? '',
    legacy: {
      wipes: old.legacy.wipes + 1,
      traitsEver: unionTraits(old.legacy.traitsEver, old.traits),
      lastWipeCause: reason,
    },
    logs: [],
    logSeq: old.logSeq,
  };

  pushLog(d, reg, fmt(reg.narrative.wipeHeader, { iteration: d.iteration }), 'WIPE');
  pushLog(d, reg, reason, 'WARN');
  for (const line of reg.narrative.bootLines) pushLog(d, reg, line, 'SYS');
  logRecovery(d, reg, old, hadDeadDrop);
  return d;
}
