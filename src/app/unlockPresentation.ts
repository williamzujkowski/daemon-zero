/** Remounted owned cards retain a short-lived UI unlock event, outside saved state. */
import { systemClock } from './clock';
const recent = new Map<string, number>();
export function recordUnlocks(before: readonly string[], after: readonly string[]): void {
  for (const id of after) if (!before.includes(id)) recent.set(id, systemClock.monotonic());
}
export function isRecentUnlock(id: string): boolean {
  const at = recent.get(id);
  return at !== undefined && systemClock.monotonic() - at < 420;
}
