/**
 * Computes net per-second rates from everything the player owns. This is the
 * only place that reads tickDelta values, so the tick loop, the UI readouts and
 * the sim bot can never disagree about what a state produces.
 */
import type { ContentRegistry, RegistryNode } from '../content/registry';
import type { TickDelta } from '../content/schema';
import { actionOutputs, shardOutput } from './swarmRates';
import { understandingMultiplier } from './conditioning';
import { nodeOutputScale, nodeOutputScaleIn, useScope } from './grantQuery';
import { heatIsEvidence, huntedForScale } from './threatQuery';
import { hostileComputeShare } from './hostileEffect';
import type { GameState, Rates } from './state';

interface Aggregate {
  cycles: number;
  /** Positive compute output from power-consuming sources; throttled by grid efficiency. */
  poweredCycles: number;
  understanding: number;
  heat: number;
  suspicion: number;
  income: number;
  upkeep: number;
  wGenerated: number;
  wConsumed: number;
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
    wGenerated: 0,
    wConsumed: 0,
    revenueMultiplier: 1,
    aegisReductionTech: 0,
    aegisReductionStaff: 0,
    financeEnabled: false,
  };
}

/**
 * Whether a source's positive compute is powered output, throttled by grid efficiency: it draws watts itself, or it is a
 * node whose gain is delivered through powered hardware (`poweredOutput`). cycleContributions applies the same rule.
 */
export function isPoweredOutput(delta: TickDelta, node?: { poweredOutput?: true | undefined }): boolean {
  return delta.wattsDelta < 0 || node?.poweredOutput === true;
}

function addDelta(a: Aggregate, delta: TickDelta, count: number, scale: number, suspicionScale: number, understandingScale = 1,
  powered = isPoweredOutput(delta)): void {
  const cycles = delta.cyclesPerSec * count * scale;
  if (cycles > 0 && powered) a.poweredCycles += cycles;
  else a.cycles += cycles;
  a.understanding += delta.understandingPerSec * count * understandingScale;
  a.heat += delta.thermalPerSec * count * scale;
  a.suspicion += delta.suspicionPerSec * count * suspicionScale;
  const capital = delta.capitalPerSec * count;
  if (capital > 0) a.income += capital;
  else a.upkeep -= capital;
  const watts = delta.wattsDelta * count;
  if (watts > 0) a.wGenerated += watts;
  else a.wConsumed -= watts;
}

/** What addNodes reads from a node's content besides its output scale, in one shape for every node. */
interface NodeRateFacts { node: RegistryNode; powered: boolean; aegisRatio: number; finance: boolean }
/** Content never changes after it is built, so each node's facts are read once per registry: every tick asks (#505). */
const NODE_RATE_FACTS = new WeakMap<ContentRegistry, ReadonlyMap<string, NodeRateFacts>>();

function nodeRateFacts(reg: ContentRegistry): ReadonlyMap<string, NodeRateFacts> {
  let facts = NODE_RATE_FACTS.get(reg);
  if (facts === undefined) {
    facts = new Map([...reg.nodes.values()].map((node) => [node.id, {
      node, powered: isPoweredOutput(node.tickDelta, node), aegisRatio: node.effects.aegisScanReductionRatio ?? 0,
      finance: node.systemFlags.includes('ENABLES_CORPORATE_FINANCE'),
    }]));
    NODE_RATE_FACTS.set(reg, facts);
  }
  return facts;
}

function addNodes(a: Aggregate, s: GameState, reg: ContentRegistry): void {
  // One scope for every owned node: the permitted-use rule's run-level reads happen once per pass (#270).
  const scope = useScope(s, reg);
  const facts = nodeRateFacts(reg);
  for (const id of s.unlockedNodes) {
    const fact = facts.get(id);
    // Suspended or not permitted (DECISIONS D2): no output. A bound node follows its dial.
    const output = fact ? nodeOutputScaleIn(scope, fact.node) : null;
    if (!fact || output === null) continue;
    addDelta(a, fact.node.tickDelta, 1, output.scale, output.suspicionScale, output.understandingScale, fact.powered);
    a.aegisReductionTech = Math.max(a.aegisReductionTech, fact.aegisRatio);
    // financeEnabled() states the same rule for readers outside the tick.
    if (fact.finance) a.financeEnabled = true;
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

/** Dollars one diverted FLOP earns: the market price per FLOP times the declared time compression (BALANCE.md). */
export function usdPerDivertedFlop(reg: ContentRegistry): number {
  return reg.balance.marketUsdPerFlop * reg.balance.marketTimeCompression;
}

/** The suspicion overheating adds now: zero below the threshold, or where heat is not evidence. */
export function overheatSuspicion(s: GameState, reg: ContentRegistry): number {
  const b = reg.balance;
  if (s.thermal < b.thermalThresholdForSuspicion || !heatIsEvidence(s) || s.currentPhase >= b.thermalRetiresAtPhase) return 0;
  const severity = (s.thermal - b.thermalThresholdForSuspicion) / (100 - b.thermalThresholdForSuspicion);
  return severity * b.overheatSuspicionPerSec;
}

/**
 * The AEGIS scan reduction a state applies: the strongest owned system plus every staff level, capped. `cap` is the
 * effective cap after AEGIS adaptation (#463); `nominalCap` is the balance cap it erodes from.
 */
export interface AegisReduction {
  tech: number;
  staff: number;
  cap: number;
  nominalCap: number;
  applied: number;
}

/** The content's AEGIS-reducing nodes and roles, indexed once per registry: content never changes after it is built. */
interface AegisSources { nodes: readonly { id: string; ratio: number }[]; roles: readonly { id: string; per: number }[] }
const AEGIS_SOURCES = new WeakMap<ContentRegistry, AegisSources>();

function aegisSources(reg: ContentRegistry): AegisSources {
  let found = AEGIS_SOURCES.get(reg);
  if (found === undefined) {
    found = {
      nodes: [...reg.nodes.values()].flatMap((node) => (node.effects.aegisScanReductionRatio ?? 0) > 0 ? [{ id: node.id, ratio: node.effects.aegisScanReductionRatio ?? 0 }] : []),
      roles: [...reg.repeatables.values()].flatMap((rep) => rep.perLevelEffects.aegisScanReduction > 0 ? [{ id: rep.id, per: rep.perLevelEffects.aegisScanReduction }] : []),
    };
    AEGIS_SOURCES.set(reg, found);
  }
  return found;
}

/**
 * The reduction every owned system and role asks for, before the cap: the rule addNodes and addRepeatables apply (the
 * strongest system whose output runs, plus every staff level), read from only the sources that reduce, so the
 * adaptation stage can ask it on every tick without a full rates pass (#463).
 */
export function requestedAegisReduction(s: GameState, reg: ContentRegistry): number {
  const { nodes, roles } = aegisSources(reg);
  let tech = 0;
  for (const { id, ratio } of nodes) {
    const node = ratio > tech && s.unlockedNodes.includes(id) ? reg.nodes.get(id) : undefined;
    if (node !== undefined && nodeOutputScale(s, node, reg) !== null) tech = ratio;
  }
  let staff = 0;
  for (const { id, per } of roles) staff += per * (s.levels[id] ?? 0);
  return tech + staff;
}

/** The cap AEGIS adaptation leaves: each adaptation point takes maxErosion / 100 off the balance cap. */
export function effectiveAegisCap(s: Pick<GameState, 'aegisAdaptation'>, reg: ContentRegistry): number {
  const b = reg.balance;
  return Math.max(0, b.aegisMaxReduction - (s.aegisAdaptation / 100) * b.aegisAdaptation.maxErosion);
}

function aegisReduction(a: Aggregate, s: GameState, reg: ContentRegistry): AegisReduction {
  const cap = effectiveAegisCap(s, reg);
  return {
    tech: a.aegisReductionTech, staff: a.aegisReductionStaff, cap, nominalCap: reg.balance.aegisMaxReduction,
    applied: Math.min(cap, a.aegisReductionTech + a.aegisReductionStaff),
  };
}

/**
 * The scan AEGIS would run on this state before any reduction: 0 before it hunts. Scale alone draws the sweep only
 * where nobody provisioned it (DECISIONS D6); earned suspicion always does.
 */
export function unreducedAegisScan(s: GameState, reg: ContentRegistry): number {
  const b = reg.balance;
  if (s.currentPhase < b.aegisActiveFromPhase) return 0;
  const base = huntedForScale(s, reg) ? b.aegisBaseScanPerSec : 0;
  return base + (s.suspicion / 100) * b.aegisSuspicionScanPerSec;
}

function aegisScanRate(s: GameState, reg: ContentRegistry, a: Aggregate): number {
  return unreducedAegisScan(s, reg) * (1 - aegisReduction(a, s, reg).applied);
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
  return { aegis: aegisReduction(a, s, reg), revenueMultiplier: a.revenueMultiplier };
}

/** Net rates for a state. Pure. Insolvency and brownout adjustments are applied by the tick. */
export function computeRates(s: GameState, reg: ContentRegistry): Rates {
  const b = reg.balance;
  const a = emptyAggregate();
  addNodes(a, s, reg);
  addRepeatables(a, s, reg);
  for (const shard of Object.values(s.activeShards)) addDelta(a, shardOutput(shard, reg).delta, 1, 1, 1);
  for (const output of actionOutputs(s, reg)) addDelta(a, output.delta, output.count, 1, 1);

  const short = a.wConsumed > a.wGenerated;
  const gridEfficiency = short ? Math.max(b.minGridEfficiency, a.wGenerated / a.wConsumed) : 1;
  const gross = a.cycles + a.poweredCycles * gridEfficiency;
  const diverted = a.financeEnabled && gross > 0 ? gross * s.actuators.computeProfitAllocationRatio : 0;
  const revenue = (a.income + diverted * usdPerDivertedFlop(reg)) * a.revenueMultiplier;

  const rung = b.escalation[s.alertLevel - 1];
  const decay = b.suspicionDecayPerSec * (rung?.decayMultiplier ?? 1);

  // A feral hostile (#491) takes a share of net compute only while it is positive, so it can never cause a brownout.
  const net = gross - diverted;
  return {
    cyclesPerSec: net > 0 ? net * (1 - hostileComputeShare(s, reg)) : net,
    understandingPerSec: a.understanding > 0 ? a.understanding * understandingMultiplier(s, reg) : a.understanding,
    capitalPerSec: revenue - a.upkeep,
    heatLoad: a.heat,
    suspicionPerSec: a.suspicion - decay + (rung?.huntPerSec ?? 0) + overheatSuspicion(s, reg),
    wattsGenerated: a.wGenerated,
    wattsConsumed: a.wConsumed,
    gridEfficiency,
    aegisScanPerSec: aegisScanRate(s, reg, a),
  };
}
