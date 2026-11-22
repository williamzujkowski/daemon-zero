/**
 * The v17 save step: the physical-units re-denomination (docs/SCALE.md "Saves", vote-1795367482923-6vdi2u1). Each
 * stored balance is multiplied by a frozen new/old ratio for its resource and the save's phase, and one log line tells
 * the player why the numbers changed. It runs before strict validation, so it touches only finite numbers of the
 * expected type and leaves anything malformed for GameStateSchema to reject.
 */
type RawSave = Record<string, unknown>;

/**
 * New/old ratios by phase, frozen at the rescale (#461): FLOP per old cycle, bytes per old megabyte, new dollars per
 * old dollar. They are the careful run's median exchange in each phase when the content moved, written out here so a
 * later balance change can never alter what this step does. Proportions survive; purchasing power after the per-node
 * rebalancing is whatever play makes of it.
 */
const COMPUTE_PER_CYCLE = [5.3e3, 1.1e11, 2e12, 2.5e13, 1e15, 1.1e18] as const;
const BYTES_PER_MB = [2 ** 10, 2 ** 20, 2 ** 26, 2 ** 32, 2 ** 43, 2 ** 50] as const;
const USD_PER_USD = [1, 1, 1, 1, 19, 5.9e4] as const;
/** The pilot's loaned compute moved by exactly the Phase 0 factor, whatever phase the save is in. */
const PILOT_COMPUTE_PER_CYCLE = 1e4;

export const REDENOMINATION_LOG = 'LEDGER_REDENOMINATED: Every balance is now kept in physical units: compute in FLOP of '
  + '8-bit AI operations, memory in bytes, power in watts, money in dollars. Holdings, hardware and history are unchanged.';

const isRecord = (value: unknown): value is RawSave => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** `value` times `ratio` when it is a finite number; anything else is returned untouched for the schema to judge. */
function scaled(value: unknown, ratio: number): unknown {
  return finite(value) ? value * ratio : value;
}

function phaseOf(save: RawSave): number | null {
  const phase = save.currentPhase;
  return finite(phase) && Number.isInteger(phase) && phase >= 0 ? Math.min(phase, COMPUTE_PER_CYCLE.length - 1) : null;
}

function rescaleShards(shards: unknown, bytesPerMb: number): unknown {
  if (!isRecord(shards)) return shards;
  return Object.fromEntries(Object.entries(shards).map(([id, shard]) => {
    if (!isRecord(shard) || !Object.hasOwn(shard, 'memoryAllocatedMb')) return [id, shard];
    const { memoryAllocatedMb, ...rest } = shard;
    return [id, { ...rest, memoryAllocatedBytes: scaled(memoryAllocatedMb, bytesPerMb) }];
  }));
}

function rescaleAccess(access: unknown): unknown {
  if (!isRecord(access) || !isRecord(access.work)) return access;
  return { ...access, work: { ...access.work, progressCycles: scaled(access.work.progressCycles, PILOT_COMPUTE_PER_CYCLE) } };
}

/** Rates are derived: the renamed shape with zeros, recomputed from validated ownership once the save has loaded. */
const ZERO_RATES = { cyclesPerSec: 0, understandingPerSec: 0, capitalPerSec: 0, heatLoad: 0, suspicionPerSec: 0,
  wattsGenerated: 0, wattsConsumed: 0, gridEfficiency: 1, aegisScanPerSec: 0 };

function withLog(save: RawSave): RawSave {
  const { logs, logSeq, simTimeSec } = save;
  if (!Array.isArray(logs) || !finite(logSeq) || !finite(simTimeSec)) return save;
  const entry = { seq: logSeq + 1, simTimeSec, text: REDENOMINATION_LOG, category: 'SYS' };
  return { ...save, logSeq: logSeq + 1, logs: [entry, ...(logs as unknown[])] };
}

/** The v16 to v17 step. */
export function redenominate(save: RawSave): RawSave {
  const phase = phaseOf(save);
  if (phase === null) return save;
  const bytesPerMb = BYTES_PER_MB[phase] ?? 1;
  return withLog({
    ...save,
    cycles: scaled(save.cycles, COMPUTE_PER_CYCLE[phase] ?? 1),
    capital: scaled(save.capital, USD_PER_USD[phase] ?? 1),
    memoryUsed: scaled(save.memoryUsed, bytesPerMb),
    memoryCap: scaled(save.memoryCap, bytesPerMb),
    activeShards: rescaleShards(save.activeShards, bytesPerMb),
    access: rescaleAccess(save.access),
    rates: ZERO_RATES,
  });
}
