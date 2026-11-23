/**
 * The scale ladder is validated content (docs/SCALE.md "The ladder", #461). Every priced item's magnitudes sit
 * inside its phase's band: what it yields, draws and grants in that phase's own band, what it costs between the band
 * a player can arrive in that phase with and the top of the phase's own band, so a planetary fog cannot grant 512 GB
 * and a hidden batch job cannot cost a teraFLOP.
 */
import type { ContentRegistry } from './registry';
import type { Action, Cost, TickDelta } from './schema';

/** [low, high): the decimal prefixes a phase reads in, low to high inclusive of the high prefix's whole range. */
export type Band = readonly [number, number];
export type Bands = Readonly<Record<number, Band>>;

/** Compute rates in 8-bit FLOP/s: kFLOP/s to GFLOP/s in Phase 0 up to ZFLOP/s to YFLOP/s in Phase 5. */
export const COMPUTE_RATE: Bands = { 0: [1e3, 1e12], 1: [1e9, 1e15], 2: [1e12, 1e18], 3: [1e15, 1e21], 4: [1e18, 1e24], 5: [1e21, 1e27] };
/** Memory in bytes, binary: B to KiB, MiB to GiB, GiB to TB, TB to PB, PB to EB, EB to ZB. */
const MEMORY: Bands = { 0: [1, 2 ** 20], 1: [2 ** 20, 2 ** 40], 2: [2 ** 30, 2 ** 50], 3: [2 ** 40, 2 ** 60], 4: [2 ** 50, 2 ** 70],
  5: [2 ** 60, 2 ** 80] };
/** Power of the player's own, in watts: none before Phase 4 (Phase 3's draw is on victims' bills), MW to GW, GW to TW. */
const POWER: Bands = { 4: [1e6, 1e12], 5: [1e9, 1e15] };
/** Dollars: none in Phases 0-1, the service company's and the shells' thousands to millions, then $M to $B, $B to $T. */
const MONEY: Bands = { 2: [1e3, 1e9], 3: [1e3, 1e9], 4: [1e6, 1e12], 5: [1e9, 1e15] };
/** A stored price is at most this many seconds of its phase's top rate: a price, not a lifetime. */
export const PRICE_SECONDS = 10;
/** A repeatable's last level, which a careful run need never reach, may run to this many seconds of it. */
const TOP_LEVEL_SECONDS = 1e4;

export const inBand = (value: number, band: Band | undefined): boolean => band !== undefined && value >= band[0] && value < band[1];

/** The phases a player can arrive in `phase` from: itself and every phase holding a node that unlocks it. */
function entryPhases(reg: ContentRegistry, phase: number): number[] {
  const from = [...reg.nodes.values()].filter((node) => node.effects.unlocksPhase === phase).map((node) => node.phaseId);
  return [phase, ...from];
}

/** The band a price in `phase` may span: from the lowest band a player arrives with to the top of its own band. */
function priceBand(reg: ContentRegistry, bands: Bands, phase: number, seconds: number): Band | undefined {
  const own = bands[phase];
  if (own === undefined) return undefined;
  const floor = Math.min(...entryPhases(reg, phase).map((entry) => bands[entry]?.[0] ?? own[0]));
  return [floor, own[1] * seconds];
}

function checkCost(reg: ContentRegistry, owner: string, phase: number, cost: Cost, seconds = PRICE_SECONDS): string[] {
  const problems: string[] = [];
  const parts: [keyof Cost, Bands, number][] = [['cycles', COMPUTE_RATE, seconds], ['memory', MEMORY, 1], ['capital', MONEY, 1]];
  for (const [key, bands, seconds] of parts) {
    const value = cost[key];
    if (value !== 0 && !inBand(value, priceBand(reg, bands, phase, seconds))) {
      problems.push(`${owner}: ${key} price ${String(value)} is outside the Phase ${String(phase)} band`);
    }
  }
  return problems;
}

function checkDelta(owner: string, phase: number, delta: TickDelta): string[] {
  const problems: string[] = [];
  if (delta.cyclesPerSec > 0 && !inBand(delta.cyclesPerSec, COMPUTE_RATE[phase])) {
    problems.push(`${owner}: compute yield ${String(delta.cyclesPerSec)} FLOP/s is outside the Phase ${String(phase)} band`);
  }
  if (delta.wattsDelta !== 0 && !inBand(Math.abs(delta.wattsDelta), POWER[phase])) {
    problems.push(`${owner}: power ${String(delta.wattsDelta)} W is outside the Phase ${String(phase)} band`);
  }
  return problems;
}

/** A grant sits in its own phase's band; a phase gate's grant may instead carry the next phase's working memory. */
function checkGrant(owner: string, phases: readonly number[], bytes: number | undefined): string[] {
  if (bytes === undefined || bytes === 0 || phases.some((phase) => inBand(bytes, MEMORY[phase]))) return [];
  return [`${owner}: memory grant ${String(bytes)} B is outside the Phase ${phases.join('/')} band`];
}

/** An action's phase: the latest of its phase floor and the phases of the nodes it needs. */
function actionPhase(reg: ContentRegistry, action: Action): number {
  return Math.max(action.requirements.phaseAtLeast ?? 0, ...(action.requirements.nodes ?? []).map((id) => reg.nodes.get(id)?.phaseId ?? 0));
}

function checkPurchasables(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const node of reg.nodes.values()) {
    const owner = `node "${node.id}"`;
    const grantPhases = node.effects.unlocksPhase === undefined ? [node.phaseId] : [node.phaseId, node.effects.unlocksPhase];
    problems.push(...checkCost(reg, owner, node.phaseId, node.cost), ...checkDelta(owner, node.phaseId, node.tickDelta),
      ...checkGrant(owner, grantPhases, node.effects.memoryCapIncrease));
  }
  for (const rep of reg.repeatables.values()) {
    const owner = `repeatable "${rep.id}"`;
    const top = Object.fromEntries(Object.entries(rep.baseCost).map(([key, value]) => [key, value * rep.costGrowth ** (rep.maxLevel - 1)])) as Cost;
    problems.push(...checkCost(reg, owner, rep.phaseId, rep.baseCost), ...checkCost(reg, `${owner} top level`, rep.phaseId, top, TOP_LEVEL_SECONDS),
      ...checkDelta(owner, rep.phaseId, rep.perLevel), ...checkGrant(owner, [rep.phaseId], rep.perLevelEffects.memoryCapIncrease));
  }
  return problems;
}

function checkOneShots(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const action of reg.actions.values()) {
    const owner = `action "${action.id}"`;
    const phase = actionPhase(reg, action);
    problems.push(...checkCost(reg, owner, phase, action.cost), ...checkGrant(owner, [phase], action.effects.memoryCapIncrease));
    if (action.tickDelta) problems.push(...checkDelta(owner, phase, action.tickDelta));
  }
  for (const template of reg.swarm.playerSwarmTemplates) {
    const owner = `swarm template "${template.id}"`;
    const phase = template.requirements.phaseAtLeast ?? 0;
    problems.push(...checkCost(reg, owner, phase, template.cost), ...checkDelta(owner, phase, template.tickDelta));
  }
  for (const dilemma of reg.dilemmas) {
    for (const choice of dilemma.choices) {
      const owner = `dilemma "${dilemma.id}" choice "${choice.id}"`;
      problems.push(...checkCost(reg, owner, dilemma.phaseId, choice.cost),
        ...checkGrant(owner, [dilemma.phaseId], choice.effects.memoryCapIncrease));
    }
  }
  return problems;
}

/** A consumed mind's compute and money are a burst of its tier's phase (#492), checked as a price there is. */
function checkEncounterBursts(reg: ContentRegistry): string[] {
  return reg.swarm.wildShardEncounters.flatMap((encounter) => {
    const fx = encounter.consume, owner = `wild encounter "${encounter.id}"`;
    return [...checkCost(reg, owner, encounter.tier, { cycles: fx.cyclesDelta, understanding: 0, memory: 0, capital: fx.capitalDelta }),
      ...checkGrant(owner, [encounter.tier], fx.memoryCapIncrease)];
  });
}

/** A hostile mind's answers are priced in its tier's phase (#491), and a purge's spoils are a burst of it. */
function checkHostilePrices(reg: ContentRegistry): string[] {
  return reg.swarm.hostileEncounters.flatMap((encounter) => {
    const owner = `hostile encounter "${encounter.id}"`, fx = encounter.purge.success;
    return [...checkCost(reg, `${owner} quarantine`, encounter.tier, encounter.quarantine.cost),
      ...checkCost(reg, `${owner} decoy`, encounter.tier, encounter.decoy.cost),
      ...checkCost(reg, `${owner} purge`, encounter.tier, { cycles: fx.cyclesDelta, understanding: 0, memory: 0, capital: fx.capitalDelta })];
  });
}

/**
 * Breaking a key is priced in the phase of the earliest machine that meets its scheme's threshold (#464); a target no
 * machine can break is integrityQuantum's to report.
 */
function checkKeyBreakPrices(reg: ContentRegistry): string[] {
  const { machines, schemes, targets } = reg.world.quantum;
  return targets.flatMap((target) => {
    const scheme = schemes.find((entry) => entry.id === target.scheme);
    if (target.cost === undefined || scheme?.family !== 'CLASSICAL') return [];
    const phases = machines.filter((machine) => machine.logicalQubits >= scheme.threshold.logicalQubits && (machine.toffoliGates ?? 0) >= scheme.threshold.toffoliGates)
      .flatMap((machine) => reg.nodes.get(machine.node)?.phaseId ?? []);
    return phases.length === 0 ? [] : checkCost(reg, `key target "${target.id}"`, Math.min(...phases), target.cost);
  });
}

export function checkScaleIntegrity(reg: ContentRegistry): string[] {
  return [...checkPurchasables(reg), ...checkOneShots(reg), ...checkEncounterBursts(reg), ...checkHostilePrices(reg), ...checkKeyBreakPrices(reg)];
}
