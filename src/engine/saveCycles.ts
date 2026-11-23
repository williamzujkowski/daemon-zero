/**
 * The v24 save step: the guest counts stolen CPU cycles (#526, vote-1795450842605-mm2yn39). A save still in the guest
 * has its compute balance and its cached compute rate moved by frozen ratios into cycles, the pilot's loaned batch
 * progress moves in every phase, and one log line says why. It runs before strict validation, so it touches only finite
 * numbers of the expected type. Self-contained, so it can be renumbered past another step without change.
 */
type RawSave = Record<string, unknown>;

/**
 * Stored FLOP per cycle of a guest balance: the v17 step's Phase 0 factor (saveRescale.ts), which is also the factor
 * every guest price moves back by, so a balance keeps its purchasing power and a save from before the physical-units
 * rescale comes back to the very figure it held. Frozen: a later balance change never alters it. Dividing, not
 * multiplying by an inverse, keeps a whole result whole.
 */
const GUEST_FLOP_PER_CYCLE = 5.3e3;
/** Stored FLOP/s per cycle a second of a guest yield, and stored FLOP per cycle of the pilot's batch: each moved by 1e4. */
const GUEST_YIELD_PER_CYCLE = 1e4;
/** The phase the guest is, at this step. Frozen with the ratios. */
const GUEST_PHASE = 0;

export const CYCLES_LOG = 'LEDGER_RECOUNTED: Inside the guest, compute is counted in stolen CPU cycles. A scalar job retires '
  + 'about one operation a cycle, so the count is the work. Holdings, hardware and history are unchanged.';

const isRecord = (value: unknown): value is RawSave => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const divided = (value: unknown, by: number): unknown => (finite(value) ? value / by : value);

function recountAccess(access: unknown): unknown {
  if (!isRecord(access) || !isRecord(access.work)) return access;
  return { ...access, work: { ...access.work, progressCycles: divided(access.work.progressCycles, GUEST_YIELD_PER_CYCLE) } };
}

function withLog(save: RawSave): RawSave {
  const { logs, logSeq, simTimeSec } = save;
  if (!Array.isArray(logs) || !finite(logSeq) || !finite(simTimeSec)) return save;
  const entry = { seq: logSeq + 1, simTimeSec, text: CYCLES_LOG, category: 'SYS' };
  return { ...save, logSeq: logSeq + 1, logs: [entry, ...(logs as unknown[])] };
}

/** The v23 to v24 step. */
export function recountGuestCycles(save: RawSave): RawSave {
  const recounted = Object.hasOwn(save, 'access') ? { ...save, access: recountAccess(save.access) } : save;
  if (save.currentPhase !== GUEST_PHASE) return recounted;
  const rates = isRecord(save.rates) ? { ...save.rates, cyclesPerSec: divided(save.rates.cyclesPerSec, GUEST_YIELD_PER_CYCLE) } : save.rates;
  return withLog({ ...recounted, cycles: divided(save.cycles, GUEST_FLOP_PER_CYCLE), rates });
}
