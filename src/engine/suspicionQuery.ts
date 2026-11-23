/**
 * What moves suspicion now (#403, #368): the rate the tick applies, every source it is made of, where the
 * response stands down, and the player actions that would lower the applied rate this second. Each lever is a
 * counterfactual through the real action and the same rate statement the tick applies, so a surface that names
 * one names a lever that acts, at every rung, whatever withholds or offsets a process.
 */
import type { ContentRegistry } from '../content/registry';
import { ActuatorSchema, type Actuator } from '../content/schema';
import { dismissRepeatable, setActuator, toggleNode, type ActionResult } from './actions';
import { actuatorLimit } from './conditioning';
import { nodeOutputScale } from './grantQuery';
import { isActuatorAvailable } from './query';
import { computeRates, overheatSuspicion } from './rates';
import { appliedSuspicionRate, scaleScrutinyPerSec } from './scrutiny';
import { executeShardCommand, releaseShard } from './shardActions';
import { powerSignature } from './signature';
import type { GameState } from './state';
import { actionOutputs, shardOutput } from './swarmRates';

export type SuspicionSourceKind = 'NODE' | 'REPEATABLE' | 'SHARD' | 'ACTION' | 'RESPONSE' | 'OVERHEAT' | 'SCRUTINY' | 'INSOLVENCY' | 'SIGNATURE';

/** One term of the applied rate, in suspicion per second; `id` names the entity for the first four kinds and the class for SIGNATURE. */
export interface SuspicionSource { kind: SuspicionSourceKind; id: string | null; perSec: number }

/** SUSPEND a node, move a DIAL to `to`, DISMISS one level of a role, or CLAMP a cohort. */
export type SuspicionLever =
  | { kind: 'SUSPEND' | 'DISMISS' | 'CLAMP' | 'RELEASE'; id: string; perSecAfter: number }
  | { kind: 'DIAL'; id: Actuator; to: number; perSecAfter: number };

export interface SuspicionOutlook {
  /** The applied rate, exactly what the tick integrates. */
  perSec: number;
  /** The rung's decay, already inside perSec; the sources minus this sum to perSec. */
  decayPerSec: number;
  /** Suspicion is above zero and its applied rate is negative. */
  falling: boolean;
  /** Below this suspicion the current rung stands down one step; null at the bottom rung. */
  standDownBelow: number | null;
  /** Every non-zero term, largest first: the head of the list is what raises suspicion most. */
  sources: SuspicionSource[];
  /** Actions the engine accepts that lower the applied rate now, by the largest drop first. */
  levers: SuspicionLever[];
}

/** A lever must lower the rate by more than float noise to count. */
const EPSILON = 1e-9;

function appliedRate(s: GameState, reg: ContentRegistry): number {
  return appliedSuspicionRate(s, computeRates(s, reg), reg);
}

function entitySources(s: GameState, reg: ContentRegistry): SuspicionSource[] {
  const out: SuspicionSource[] = [];
  for (const id of s.unlockedNodes) {
    const node = reg.nodes.get(id);
    const output = node ? nodeOutputScale(s, node, reg) : null;
    if (node && output) out.push({ kind: 'NODE', id, perSec: node.tickDelta.suspicionPerSec * output.suspicionScale });
  }
  for (const [id, level] of Object.entries(s.levels)) {
    const rep = reg.repeatables.get(id);
    if (rep && level > 0) out.push({ kind: 'REPEATABLE', id, perSec: rep.perLevel.suspicionPerSec * level });
  }
  for (const [id, shard] of Object.entries(s.activeShards)) out.push({ kind: 'SHARD', id, perSec: shardOutput(shard, reg).delta.suspicionPerSec });
  for (const output of actionOutputs(s, reg)) out.push({ kind: 'ACTION', id: output.id, perSec: output.delta.suspicionPerSec * output.count });
  return out;
}

/** The terms computeRates and the applied-rate statement add, one per source, so they sum to the applied rate. */
export function suspicionSources(s: GameState, reg: ContentRegistry): SuspicionSource[] {
  const rates = computeRates(s, reg);
  const rung = reg.balance.escalation[s.alertLevel - 1];
  const fixed: SuspicionSource[] = [
    { kind: 'RESPONSE', id: null, perSec: rung?.huntPerSec ?? 0 },
    { kind: 'OVERHEAT', id: null, perSec: overheatSuspicion(s, reg) },
    { kind: 'SCRUTINY', id: null, perSec: scaleScrutinyPerSec(s, rates, reg) },
    { kind: 'INSOLVENCY', id: null, perSec: s.insolvent ? reg.balance.insolvencySuspicionPerSec : 0 },
  ];
  // Each power source or heat sink with visible watts, by the share of the signature it draws (#482).
  const signature = (powerSignature(s, rates, reg)?.terms ?? []).map((term): SuspicionSource => ({ kind: 'SIGNATURE', id: term.classId, perSec: term.perSec }));
  return [...entitySources(s, reg), ...fixed, ...signature].filter((source) => source.perSec !== 0).sort((a, b) => b.perSec - a.perSec);
}

function lowered(result: ActionResult, now: number, reg: ContentRegistry): number | null {
  if (!result.ok) return null;
  const after = appliedRate(result.state, reg);
  return after < now - EPSILON ? after : null;
}

/**
 * The highest setting the rendered control can leave a dial at: the engine's cap, and for the revenue buttons also
 * the balance's maximum allocation (src/ui/actuatorSteps.ts), so a lever is always a setting a player can press.
 */
function dialTop(s: GameState, id: Actuator, reg: ContentRegistry): number {
  const limit = actuatorLimit(s, id, reg);
  return id === 'computeProfitAllocationRatio' ? Math.min(limit, reg.balance.maxProfitAllocation) : limit;
}

function dialLevers(s: GameState, now: number, reg: ContentRegistry): SuspicionLever[] {
  const out: SuspicionLever[] = [];
  for (const id of ActuatorSchema.options) {
    if (!isActuatorAvailable(s, id, reg)) continue;
    // Either end of the dial: a linear binding is lowest at 0, a complement binding at its limit.
    let best: SuspicionLever | null = null;
    for (const to of [0, dialTop(s, id, reg)]) {
      if (Math.abs(to - s.actuators[id]) < EPSILON) continue;
      const after = lowered(setActuator(s, id, to, reg), now, reg);
      if (after !== null && (best === null || after < best.perSecAfter)) best = { kind: 'DIAL', id, to, perSecAfter: after };
    }
    if (best) out.push(best);
  }
  return out;
}

function entityLevers(s: GameState, now: number, reg: ContentRegistry): SuspicionLever[] {
  const out: SuspicionLever[] = [];
  const add = (kind: 'SUSPEND' | 'DISMISS' | 'CLAMP' | 'RELEASE', id: string, result: ActionResult): void => {
    const after = lowered(result, now, reg);
    if (after !== null) out.push({ kind, id, perSecAfter: after });
  };
  for (const id of s.unlockedNodes) if (!s.disabledNodes.includes(id)) add('SUSPEND', id, toggleNode(s, id, reg));
  for (const [id, level] of Object.entries(s.levels)) if (level > 0) add('DISMISS', id, dismissRepeatable(s, id, reg));
  for (const id of Object.keys(s.activeShards)) add('CLAMP', id, executeShardCommand(s, id, 'CLAMP', reg));
  for (const id of Object.keys(s.activeShards)) add('RELEASE', id, releaseShard(s, id, reg));
  return out;
}

/** Every lever that lowers the applied rate now, by the largest drop first. */
export function suspicionLevers(s: GameState, reg: ContentRegistry): SuspicionLever[] {
  const now = appliedRate(s, reg);
  return [...entityLevers(s, now, reg), ...dialLevers(s, now, reg)].sort((a, b) => a.perSecAfter - b.perSecAfter);
}

/** The whole picture a response notice or a suspicion readout reads from. Pure. */
export function suspicionOutlook(s: GameState, reg: ContentRegistry): SuspicionOutlook {
  const perSec = appliedRate(s, reg);
  const rung = reg.balance.escalation[s.alertLevel - 1];
  return {
    perSec,
    decayPerSec: reg.balance.suspicionDecayPerSec * (rung?.decayMultiplier ?? 1),
    falling: s.suspicion > 0 && perSec < 0,
    standDownBelow: rung ? rung.at - reg.balance.escalationHysteresis : null,
    sources: suspicionSources(s, reg),
    levers: suspicionLevers(s, reg),
  };
}
