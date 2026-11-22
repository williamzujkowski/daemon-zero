/**
 * The feed in the kernel log (#460, vote-1795370594185-8lxz9i1): a source routed to the log adds one of its
 * eligible lines each time simulated time crosses a routine interval. It reads only saved time, so a reload
 * never repeats a moment, and it writes only the log.
 */
import { ambientFeedSource, eligibleLoggedFeed } from '../speechQuery';
import { storyHoldsChannel } from '../routine';
import { pushLog } from '../util';
import type { TickSystem } from './types';

/** Float steps of 1/tickHz must not move a boundary by a tick. */
const STEP_TOLERANCE_SEC = 1e-9;

/** The interval count at `time`: a line is due when a step moves it. */
function boundary(time: number, interval: number): number {
  return Math.floor((time + STEP_TOLERANCE_SEC) / interval);
}

/**
 * Dormant time never counts (an absence banks nothing), a foreshadowed or open story keeps the channel, and a
 * line another stage logged this very tick (routine activity runs first) takes the boundary, so the log gets at
 * most one new line per interval from here. The line is the boundary's index into the eligible list: the same
 * on every run, and a different line each interval while the list holds still.
 */
export const relayLoggedFeed: TickSystem = (d, { dt, reg, dormant }) => {
  if (dormant || storyHoldsChannel(d)) return undefined;
  const interval = reg.balance.routineIntervalSec;
  const due = boundary(d.simTimeSec, interval);
  if (due === boundary(d.simTimeSec - dt, interval)) return undefined;
  if (d.logs[0]?.simTimeSec === d.simTimeSec) return undefined;
  const category = ambientFeedSource(d, reg)?.kernelLog?.category;
  const lines = eligibleLoggedFeed(d, reg);
  const line = lines[due % lines.length];
  if (category !== undefined && line !== undefined) pushLog(d, reg, line.text, category);
  return undefined;
};
