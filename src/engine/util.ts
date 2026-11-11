import type { ContentRegistry } from '../content/registry';
import type { LogCategory } from '../content/schema';
import type { GameState } from './state';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Replaces {name} placeholders in a narrative template. Unknown placeholders are left as-is. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? String(vars[key]) : match,
  );
}

/**
 * Appends a log entry to a draft state (newest first, capped).
 * Convention used across the engine: a parameter named `d` is a draft that the
 * caller has already cloned and that may be reassigned field by field. Nested
 * arrays and objects are replaced, never mutated in place.
 */
export function pushLog(d: GameState, reg: ContentRegistry, text: string, category: LogCategory): void {
  d.logSeq += 1;
  d.logs = [{ seq: d.logSeq, simTimeSec: d.simTimeSec, text, category }, ...d.logs].slice(
    0,
    reg.balance.maxLogEntries,
  );
}
