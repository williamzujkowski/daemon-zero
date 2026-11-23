/**
 * The free fallback, pulled on a real state (#461, #488): every free lever in the table (src/content/constrainedResources.ts)
 * that relieves a constrained resource, and nothing that costs. Then each row's trap is read off the engine's own rates.
 */
import { CONTENT } from '../src/content';
import { CONSTRAINED_RESOURCES, worsensAny, type ResourceName } from '../src/content/constrainedResources';
import type { TickDelta } from '../src/content/schema';
import { actuatorLimit, appliedSuspicionRate, computeRates, dismissRepeatable, financeEnabled, isActuatorAvailable, releaseShard, setActuator,
  shardOutput, toggleNode, type GameState } from '../src/engine';

const b = CONTENT.balance;
const scrutinised = (s: GameState): boolean => CONTENT.phases.some((phase) => phase.phaseId === s.currentPhase && phase.scaleScrutiny !== undefined);

/** Whether an output worsens some row now: any term against its row, or income where the books are read (scale scrutiny). */
export function worsensNow(s: GameState, delta: TickDelta): boolean {
  return worsensAny(delta) || (delta.capitalPerSec > 0 && scrutinised(s));
}

function undoAll(start: GameState, step: (s: GameState) => { ok: boolean; state: GameState }): GameState {
  let s = start;
  for (let next = step(s); next.ok; next = step(s)) s = next.state;
  return s;
}

/** The allocation dial at the least diversion that keeps capital from falling: solvency without income to scrutinise. */
function solventDial(start: GameState): GameState {
  const name = 'computeProfitAllocationRatio';
  if (!isActuatorAvailable(start, name, CONTENT) || !financeEnabled(start, CONTENT)) return start;
  const at = (ratio: number) => { const set = setActuator(start, name, ratio, CONTENT); return set.ok ? set.state : start; };
  const top = actuatorLimit(start, name, CONTENT);
  const low = computeRates(at(0), CONTENT).capitalPerSec, high = computeRates(at(top), CONTENT).capitalPerSec;
  if (low >= 0 || high <= low) return at(low >= 0 ? 0 : top);
  // Revenue is linear in the dial, so the break-even setting is exact; a hair above it absorbs rounding.
  return at(Math.min(top, (top * -low) / (high - low) * (1 + 1e-9)));
}

/**
 * Every free lever that relieves something, pulled: each worsening track level released, each worsening node suspended,
 * each worsening cohort's members released, each dial-bound node that worsens turned to its quiet end, the allocation
 * dial at break-even. `withRelease: false` is the lever set as it stood at 97d639f, before cohorts could be released.
 */
export function freeFallback(start: GameState, { withRelease = true } = {}): GameState {
  let s = start;
  for (const rep of CONTENT.repeatables.values()) {
    if (rep.dismissable && worsensNow(s, rep.perLevel)) s = undoAll(s, (state) => dismissRepeatable(state, rep.id, CONTENT));
  }
  for (const id of s.unlockedNodes) {
    const node = CONTENT.nodes.get(id);
    if (node?.suspendable === true && !s.disabledNodes.includes(id) && worsensNow(s, node.tickDelta)) {
      const suspended = toggleNode(s, id, CONTENT);
      if (suspended.ok) s = suspended.state;
    }
    const dial = node?.actuatorBinding;
    if (node && dial !== undefined && node.actuatorMode !== 'complement' && worsensNow(s, node.tickDelta)) {
      const quiet = setActuator(s, dial, 0, CONTENT);
      if (quiet.ok) s = quiet.state;
    }
  }
  if (withRelease) {
    for (const [id, shard] of Object.entries(s.activeShards)) {
      if (worsensNow(s, shardOutput(shard, CONTENT).delta)) s = undoAll(s, (state) => releaseShard(state, id, CONTENT));
    }
  }
  return solventDial(s);
}

/** The heat load the room sheds while staying at or below the overheat threshold. */
export const COOLING_HEADROOM = (b.thermalThresholdForSuspicion - b.ambientThermal) * b.thermalDissipationPerSec;

/**
 * Seconds from just under the top rung to below the first, if suspicion's own sources are at most zero: each rung's
 * span (down to its stand-down point) at that rung's decay. The top rung hunts, so nothing above it is free.
 */
export function suspicionRecoverySec(): number {
  const ladder = b.escalation;
  let total = 0;
  for (let rung = ladder.length - 1; rung >= 1; rung--) {
    const here = ladder[rung - 1], above = ladder[rung];
    if (!here || !above) continue;
    total += (above.at - (here.at - b.escalationHysteresis)) / (b.suspicionDecayPerSec * here.decayMultiplier);
  }
  const first = ladder[0];
  return total + (first ? first.at - b.escalationHysteresis : 0) / b.suspicionDecayPerSec;
}

/** Each row's trap read off the state (after every timed output has expired): the rows that are trapped, with how. */
export function traps(state: GameState): string[] {
  const latest = Math.max(state.simTimeSec, ...Object.values(state.actionEffectUntil));
  const s = { ...state, simTimeSec: latest };
  const r = computeRates(s, CONTENT);
  // Suspicion's own sources: the applied rate at the bottom of the ladder, overheat and insolvency (their own rows) aside.
  const bottom = { ...s, alertLevel: 0, insolvent: false, thermal: Math.min(s.thermal, b.thermalThresholdForSuspicion) };
  const sources = appliedSuspicionRate(bottom, computeRates(bottom, CONTENT), CONTENT) + b.suspicionDecayPerSec;
  const checks: Record<ResourceName, [boolean, string]> = {
    compute: [r.cyclesPerSec >= 0, `net compute ${String(r.cyclesPerSec)} FLOP/s`],
    capital: [r.capitalPerSec >= -1e-6 * Math.max(1, Math.abs(r.capitalPerSec)), `net capital ${String(r.capitalPerSec)} $/s`],
    power: [r.wattsGenerated >= r.wattsConsumed, `power ${String(r.wattsGenerated)} W against ${String(r.wattsConsumed)} W`],
    thermal: [s.currentPhase >= b.thermalRetiresAtPhase || r.heatLoad <= COOLING_HEADROOM + 1e-9, `heat load ${String(r.heatLoad)}`],
    memory: [s.memoryUsed <= s.memoryCap, `memory ${String(s.memoryUsed)} B used of ${String(s.memoryCap)} B`],
    storage: [s.storageUsed <= s.storageCap, `storage ${String(s.storageUsed)} B used of ${String(s.storageCap)} B`],
    understanding: [r.understandingPerSec >= 0, `understanding ${String(r.understandingPerSec)}/s`],
    suspicion: [sources <= 1e-9, `suspicion sources ${String(sources)}/s at the bottom rung`],
  };
  return CONSTRAINED_RESOURCES.flatMap((row) => checks[row.resource][0] ? [] : [`${row.resource}: ${checks[row.resource][1]}`]);
}
