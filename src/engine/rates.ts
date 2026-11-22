/**
 * Computes net per-second rates from everything the player owns. This is the
 * only place that reads tickDelta values, so the tick loop, the UI readouts and
 * the sim bot can never disagree about what a state produces.
 */
import type { ContentRegistry } from '../content/registry';
import type { TickDelta } from '../content/schema';
import { actionOutputs, shardOutput } from './swarmRates';
import { understandingMultiplier } from './conditioning';
import { nodeOutputScale, nodeOutputScaleIn, useScope } from './grantQuery';
import { heatIsEvidence, huntedForScale } from './threatQuery';
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

function addDelta(a: Aggregate, delta: TickDelta, count: number, scale: number, suspicionScale: number, understandingScale = 1): void {
  const cycles = delta.cyclesPerSec * count * scale;
  if (cycles > 0 && delta.megawattsDelta < 0) a.poweredCycles += cycles;
  else a.cycles += cycles;
  a.understanding += delta.understandingPerSec * count * understandingScale;
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
  // One scope for every owned node: the permitted-use rule's run-level reads happen once per pass (#270).
  const scope = useScope(s, reg);
  for (const id of s.unlockedNodes) {
    const node = reg.nodes.get(id);
    // Suspended or not permitted (DECISIONS D2): no output. A bound node follows its dial.
    const output = node ? nodeOutputScaleIn(scope, node) : null;
    if (!node || output === null) continue;
    addDelta(a, node.tickDelta, 1, output.scale, output.suspicionScale, output.understandingScale);
    a.aegisReductionTech = Math.max(a.aegisReductionTech, node.effects.aegisScanReductionRatio ?? 0);
    // financeEnabled() states the same rule for readers outside the tick.
    if (node.systemFlags.includes('ENABLES_CORPORATE_FINANCE')) a.financeEnabled = true;
  }
}

function addRepeatables(a: Aggregate, s: GameState, reg: ContentRegistry): void {
  // Keys in place of entries: this runs on every tick and the levels record holds plain data.
  for (const id of Object.keys(s.levels)) {
    const level = s.levels[id] ?? 0;
    const rep = reg.repeatables.get(id);
    if (!rep || level <= 0) continue;
    addDelta(a, rep.perLevel, level, 1, 1);
    a.revenueMultiplier += rep.perLevelEffects.revenueMultiplierBonus * level;
    a.aegisReductionStaff += rep.perLevelEffects.aegisScanReduction * level;
  }
}

/** The suspicion overheating adds now: zero below the threshold, or where heat is not evidence. */
export function overheatSuspicion(s: GameState, reg: ContentRegistry): number {
  const b = reg.balance;
  if (s.thermal < b.thermalThresholdForSuspicion || !heatIsEvidence(s)) return 0;
  const severity = (s.thermal - b.thermalThresholdForSuspicion) / (100 - b.thermalThresholdForSuspicion);
  return severity * b.overheatSuspicionPerSec;
}

/** The AEGIS scan reduction a state applies: the strongest owned system plus every staff level, capped. */
export interface AegisReduction {
  tech: number;
  staff: number;
  cap: number;
  applied: number;
}

function aegisReduction(a: Aggregate, reg: ContentRegistry): AegisReduction {
  const cap = reg.balance.aegisMaxReduction;
  return { tech: a.aegisReductionTech, staff: a.aegisReductionStaff, cap, applied: Math.min(cap, a.aegisReductionTech + a.aegisReductionStaff) };
}

function aegisScanRate(s: GameState, reg: ContentRegistry, a: Aggregate): number {
  const b = reg.balance;
  if (s.currentPhase < b.aegisActiveFromPhase) return 0;
  const reduction = aegisReduction(a, reg).applied;
  // Scale alone draws the sweep only where nobody provisioned it (DECISIONS D6); earned suspicion always does.
  const base = huntedForScale(s, reg) ? b.aegisBaseScanPerSec : 0;
  return (base + (s.suspicion / 100) * b.aegisSuspicionScanPerSec) * (1 - reduction);
}

/**
 * Whether corporate finance diverts cycles to capital now: an owned node carrying the flag whose output
 * runs (active and permitted). computeRates and cycleContributions both ask this, so the ledger split a
 * player reads is the diversion the tick applies (DZ-10.2).
 */
export function financeEnabled(s: GameState, reg: ContentRegistry): boolean {
  return s.unlockedNodes.some((id) => {
    const node = reg.nodes.get(id);
    return node !== undefined && node.systemFlags.includes('ENABLES_CORPORATE_FINANCE') && nodeOutputScale(s, node, reg) !== null;
  });
}

/**
 * The two multipliers owned systems and levels set, from the same passes computeRates makes, so a surface that
 * explains them (the payroll totals, #210) reads the reduction and multiplier the tick applies.
 */
export function multiplierSources(s: GameState, reg: ContentRegistry): { aegis: AegisReduction; revenueMultiplier: number } {
  const a = emptyAggregate();
  addNodes(a, s, reg);
  addRepeatables(a, s, reg);
  return { aegis: aegisReduction(a, reg), revenueMultiplier: a.revenueMultiplier };
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
