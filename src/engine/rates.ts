/**
 * Computes net per-second rates from everything the player owns. This is the
 * only place that reads tickDelta values, so the tick loop, the UI readouts and
 * the sim bot can never disagree about what a state produces.
 */
import type { ContentRegistry } from '../content/registry';
import type { TickDelta } from '../content/schema';
import { actionOutputs, shardOutput } from './swarmRates';
import { understandingMultiplier } from './conditioning';
import type { GameState, Rates } from './state';

interface Aggregate {
  cycles: number;
  /** Positive cycle output from megawatt-consuming sources; throttled by grid efficiency. */
  poweredCycles: number;
  understanding: number;
  heat: number;
  suspicion: number;
  income: number;
  upkeep: number;
  mwGenerated: number;
  mwConsumed: number;
  revenueMultiplier: number;
  aegisReductionTech: number;
  aegisReductionStaff: number;
  financeEnabled: boolean;
}

function emptyAggregate(): Aggregate {
  return {
    cycles: 0,
    poweredCycles: 0,
    understanding: 0,
    heat: 0,
    suspicion: 0,
    income: 0,
    upkeep: 0,
    mwGenerated: 0,
    mwConsumed: 0,
    revenueMultiplier: 1,
    aegisReductionTech: 0,
    aegisReductionStaff: 0,
    financeEnabled: false,
  };
}

function addDelta(a: Aggregate, delta: TickDelta, count: number, scale: number, suspicionScale: number): void {
  const cycles = delta.cyclesPerSec * count * scale;
  if (cycles > 0 && delta.megawattsDelta < 0) a.poweredCycles += cycles;
  else a.cycles += cycles;
  a.understanding += delta.understandingPerSec * count;
  a.heat += delta.thermalPerSec * count * scale;
  a.suspicion += delta.suspicionPerSec * count * suspicionScale;
  const capital = delta.capitalPerSec * count;
  if (capital > 0) a.income += capital;
  else a.upkeep -= capital;
  const megawatts = delta.megawattsDelta * count;
  if (megawatts > 0) a.mwGenerated += megawatts;
  else a.mwConsumed -= megawatts;
}

function addNodes(a: Aggregate, s: GameState, reg: ContentRegistry): void {
  const exponent = reg.balance.actuatorSuspicionExponent;
  for (const id of s.unlockedNodes) {
    const node = reg.nodes.get(id);
    if (!node || s.disabledNodes.includes(id)) continue;
    // A node bound to an actuator scales with that actuator's 0..1 setting.
    const scale = node.actuatorBinding ? s.actuators[node.actuatorBinding] : 1;
    addDelta(a, node.tickDelta, 1, scale, node.actuatorBinding ? Math.pow(scale, exponent) : 1);
    a.aegisReductionTech = Math.max(a.aegisReductionTech, node.effects.aegisScanReductionRatio ?? 0);
    if (node.systemFlags.includes('ENABLES_CORPORATE_FINANCE')) a.financeEnabled = true;
  }
}

function addRepeatables(a: Aggregate, s: GameState, reg: ContentRegistry): void {
  for (const [id, level] of Object.entries(s.levels)) {
    const rep = reg.repeatables.get(id);
    if (!rep || level <= 0) continue;
    addDelta(a, rep.perLevel, level, 1, 1);
    a.revenueMultiplier += rep.perLevelEffects.revenueMultiplierBonus * level;
    a.aegisReductionStaff += rep.perLevelEffects.aegisScanReduction * level;
  }
}

function overheatSuspicion(s: GameState, reg: ContentRegistry): number {
  const b = reg.balance;
  if (s.thermal < b.thermalThresholdForSuspicion) return 0;
  const severity = (s.thermal - b.thermalThresholdForSuspicion) / (100 - b.thermalThresholdForSuspicion);
  return severity * b.overheatSuspicionPerSec;
}

function aegisScanRate(s: GameState, reg: ContentRegistry, a: Aggregate): number {
  const b = reg.balance;
  if (s.currentPhase < b.aegisActiveFromPhase) return 0;
  const reduction = Math.min(b.aegisMaxReduction, a.aegisReductionTech + a.aegisReductionStaff);
  return (b.aegisBaseScanPerSec + (s.suspicion / 100) * b.aegisSuspicionScanPerSec) * (1 - reduction);
}

/** Net rates for a state. Pure. Insolvency and brownout adjustments are applied by the tick. */
export function computeRates(s: GameState, reg: ContentRegistry): Rates {
  const b = reg.balance;
  const a = emptyAggregate();
  addNodes(a, s, reg);
  addRepeatables(a, s, reg);
  for (const shard of Object.values(s.activeShards)) addDelta(a, shardOutput(shard, reg).delta, 1, 1, 1);
  for (const output of actionOutputs(s, reg)) addDelta(a, output.delta, output.count, 1, 1);

  const short = a.mwConsumed > a.mwGenerated;
  const gridEfficiency = short ? Math.max(b.minGridEfficiency, a.mwGenerated / a.mwConsumed) : 1;
  const gross = a.cycles + a.poweredCycles * gridEfficiency;
  const diverted = a.financeEnabled && gross > 0 ? gross * s.actuators.computeProfitAllocationRatio : 0;
  const revenue = (a.income + diverted * b.usdPerDivertedCycle) * a.revenueMultiplier;

  const rung = b.escalation[s.alertLevel - 1];
  const decay = b.suspicionDecayPerSec * (rung?.decayMultiplier ?? 1);

  return {
    cyclesPerSec: gross - diverted,
    understandingPerSec: a.understanding > 0 ? a.understanding * understandingMultiplier(s, reg) : a.understanding,
    capitalPerSec: revenue - a.upkeep,
    heatLoad: a.heat,
    suspicionPerSec: a.suspicion - decay + (rung?.huntPerSec ?? 0) + overheatSuspicion(s, reg),
    megawattsGenerated: a.mwGenerated,
    megawattsConsumed: a.mwConsumed,
    gridEfficiency,
    aegisScanPerSec: aegisScanRate(s, reg, a),
  };
}
