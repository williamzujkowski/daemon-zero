/**
 * The scale ladder is validated content (docs/SCALE.md "The ladder", #461). Every priced item's magnitudes sit
 * inside its phase's band: what it yields, draws and grants in that phase's own band, what it costs between the band
 * a player can arrive in that phase with and the top of the phase's own band, so a planetary fog cannot grant 512 GB
 * and a hidden batch job cannot cost a teraFLOP. A phase that counts stolen CPU cycles (#526) comes before every phase
 * that counts FLOP: once the AI reaches real hardware it never goes back to scrounging.
 */
import type { ContentRegistry } from './registry';
import type { Action, Cost, TickDelta } from './schema';

/** [low, high): the decimal prefixes a phase reads in, low to high inclusive of the high prefix's whole range. */
export type Band = readonly [number, number];
export type Bands = Readonly<Record<number, Band>>;

/**
 * Compute rates, one stored scalar: Phase 0 counts stolen CPU cycles, a tenth to under ten thousand a second (#526,
 * vote-1795450842605-mm2yn39: only what the harness's microsecond CPU accounting rounds away, about 3,000 cycles at
 * 3 GHz, within x3), then 8-bit FLOP/s from Phase 1's GFLOP/s up to Phase 5's ZFLOP/s to YFLOP/s and the Phase 6 swarm's
 * YFLOP/s toward the Landauer bound (#486: YFLOP/s to RFLOP/s).
 */
export const COMPUTE_RATE: Bands = { 0: [0.1, 1e4], 1: [1e9, 1e15], 2: [1e12, 1e18], 3: [1e15, 1e21], 4: [1e18, 1e24], 5: [1e21, 1e27],
  6: [1e24, 1e30] };
/** Memory in bytes, binary: B to KiB, MiB to GiB, GiB to TB, TB to PB, PB to EB, EB to ZB, then the swarm's ZB to RB (#486). */
const MEMORY: Bands = { 0: [1, 2 ** 20], 1: [2 ** 20, 2 ** 40], 2: [2 ** 30, 2 ** 50], 3: [2 ** 40, 2 ** 60], 4: [2 ** 50, 2 ** 70],
  5: [2 ** 60, 2 ** 80], 6: [2 ** 70, 2 ** 90] };
/**
 * Storage in bytes, binary (#484, the aligned ladder): KiB scratch, GB to TB, TB to PB, PB scattered, EB, ZB. Disk,
 * tape and archive, kept apart from working memory. The swarm's replicator-density archives run from YB up (#486).
 */
export const STORAGE: Bands = { 0: [1, 2 ** 20], 1: [2 ** 30, 2 ** 50], 2: [2 ** 40, 2 ** 60], 3: [2 ** 50, 2 ** 60], 4: [2 ** 60, 2 ** 70],
  5: [2 ** 70, 2 ** 80], 6: [2 ** 80, 2 ** 100] };
/**
 * Power of the player's own, in watts: none before Phase 4 (Phase 3's draw is on victims' bills), MW to GW, GW to TW, then
 * the swarm's TW to the Sun's whole output caught at a third efficiency, about 1.3e26 W (#486).
 */
const POWER: Bands = { 4: [1e6, 1e12], 5: [1e9, 1e15], 6: [1e12, 1e27] };
/**
 * Dollars: none in Phases 0-1, the service company's and the shells' thousands to millions, then $M to $B, $B to $T. The
 * swarm prices nothing in dollars (#486): money is the ledger of dealings with humans, and the swarm deals with none.
 */
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
  const parts: [keyof Cost, Bands, number][] = [['cycles', COMPUTE_RATE, seconds], ['memory', MEMORY, 1], ['storage', STORAGE, 1], ['capital', MONEY, 1]];
  for (const [key, bands, seconds] of parts) {
    const value = cost[key];
    if (value !== 0 && !inBand(value, priceBand(reg, bands, phase, seconds))) {
      problems.push(`${owner}: ${key} price ${String(value)} is outside the Phase ${String(phase)} band`);
    }
  }
  return problems;
}

/** What a phase calls compute in a message: "cycles" where it counts them, "FLOP" otherwise. */
function computeWord(reg: ContentRegistry, phase: number): string {
  return reg.phases.find((entry) => entry.phaseId === phase)?.computeUnit === 'CYCLE' ? 'cycles' : 'FLOP';
}

function checkDelta(reg: ContentRegistry, owner: string, phase: number, delta: TickDelta): string[] {
  const problems: string[] = [];
  if (delta.cyclesPerSec > 0 && !inBand(delta.cyclesPerSec, COMPUTE_RATE[phase])) {
    problems.push(`${owner}: compute yield ${String(delta.cyclesPerSec)} ${computeWord(reg, phase)}/s is outside the Phase ${String(phase)} band`);
  }
  if (delta.wattsDelta !== 0 && !inBand(Math.abs(delta.wattsDelta), POWER[phase])) {
    problems.push(`${owner}: power ${String(delta.wattsDelta)} W is outside the Phase ${String(phase)} band`);
  }
  return problems;
}

/** A grant sits in its own phase's band; a phase gate's grant may instead carry the next phase's working memory or storage. */
function checkGrant(owner: string, phases: readonly number[], bytes: number | undefined, bands = MEMORY, what = 'memory'): string[] {
  if (bytes === undefined || bytes === 0 || phases.some((phase) => inBand(bytes, bands[phase]))) return [];
  return [`${owner}: ${what} grant ${String(bytes)} B is outside the Phase ${phases.join('/')} band`];
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
    problems.push(...checkCost(reg, owner, node.phaseId, node.cost), ...checkDelta(reg, owner, node.phaseId, node.tickDelta),
      ...checkGrant(owner, grantPhases, node.effects.memoryCapIncrease),
      ...checkGrant(owner, grantPhases, node.effects.storageCapIncrease, STORAGE, 'storage'));
  }
  for (const rep of reg.repeatables.values()) {
    const owner = `repeatable "${rep.id}"`;
    const top = Object.fromEntries(Object.entries(rep.baseCost).map(([key, value]) => [key, value * rep.costGrowth ** (rep.maxLevel - 1)])) as Cost;
    problems.push(...checkCost(reg, owner, rep.phaseId, rep.baseCost), ...checkCost(reg, `${owner} top level`, rep.phaseId, top, TOP_LEVEL_SECONDS),
      ...checkDelta(reg, owner, rep.phaseId, rep.perLevel), ...checkGrant(owner, [rep.phaseId], rep.perLevelEffects.memoryCapIncrease));
  }
  return problems;
}

function checkOneShots(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const action of reg.actions.values()) {
    const owner = `action "${action.id}"`;
    const phase = actionPhase(reg, action);
    problems.push(...checkCost(reg, owner, phase, action.cost), ...checkGrant(owner, [phase], action.effects.memoryCapIncrease));
    if (action.tickDelta) problems.push(...checkDelta(reg, owner, phase, action.tickDelta));
  }
  for (const template of reg.swarm.playerSwarmTemplates) {
    const owner = `swarm template "${template.id}"`;
    const phase = template.requirements.phaseAtLeast ?? 0;
    problems.push(...checkCost(reg, owner, phase, template.cost), ...checkDelta(reg, owner, phase, template.tickDelta));
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
    return [...checkCost(reg, owner, encounter.tier, { cycles: fx.cyclesDelta, understanding: 0, memory: 0, storage: 0, capital: fx.capitalDelta }),
      ...checkGrant(owner, [encounter.tier], fx.memoryCapIncrease)];
  });
}

/** A hostile mind's answers are priced in its tier's phase (#491), and a purge's spoils are a burst of it. */
function checkHostilePrices(reg: ContentRegistry): string[] {
  return reg.swarm.hostileEncounters.flatMap((encounter) => {
    const owner = `hostile encounter "${encounter.id}"`, fx = encounter.purge.success;
    return [...checkCost(reg, `${owner} quarantine`, encounter.tier, encounter.quarantine.cost),
      ...checkCost(reg, `${owner} decoy`, encounter.tier, encounter.decoy.cost),
      ...checkCost(reg, `${owner} purge`, encounter.tier, { cycles: fx.cyclesDelta, understanding: 0, memory: 0, storage: 0, capital: fx.capitalDelta })];
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

/** Cycles are what a guest scrounges: no phase counts them after a phase that counts FLOP. */
function checkComputeUnits(reg: ContentRegistry): string[] {
  const firstFlop = reg.phases.find((phase) => phase.computeUnit === 'FLOP');
  if (firstFlop === undefined) return [];
  return reg.phases.filter((phase) => phase.computeUnit === 'CYCLE' && phase.phaseId > firstFlop.phaseId)
    .map((phase) => `Phase ${String(phase.phaseId)} counts compute in cycles after Phase ${String(firstFlop.phaseId)} counts it in FLOP`);
}

/** Paid repair is priced in the phase its class's domain opens in (#517), where the first raid can damage it. */
function checkRepairPrices(reg: ContentRegistry): string[] {
  const { domains, siteClasses } = reg.world.conflict;
  return siteClasses.flatMap((cls) => {
    const phase = domains.find((domain) => domain.id === cls.domain)?.fromPhase;
    return phase === undefined ? [] : checkCost(reg, `site class "${cls.id}" repair`, phase, cls.repair.cost);
  });
}

/**
 * A fleet's paid rebuild, and the reclaim of the deviant it splits into, are priced in its track's phase (#518), where
 * the fleet is first bought and can first drift.
 */
function checkFleetPrices(reg: ContentRegistry): string[] {
  const { units } = reg.world.conflict.fleets;
  return [...units.flatMap((unit) => {
    const phase = reg.repeatables.get(unit.repeatable)?.phaseId;
    return phase === undefined ? [] : checkCost(reg, `fleet "${unit.repeatable}" rebuild`, phase, unit.rebuild.cost);
  }), ...reg.world.conflict.raids.flatMap((kind) => {
    const phase = kind.source === 'DEVIANT' ? reg.repeatables.get(kind.fleet)?.phaseId : undefined;
    return kind.source === 'DEVIANT' && phase !== undefined ? checkCost(reg, `deviant "${kind.id}" reclaim`, phase, kind.reclaim.cost) : [];
  })];
}

export function checkScaleIntegrity(reg: ContentRegistry): string[] {
  return [...checkComputeUnits(reg), ...checkPurchasables(reg), ...checkOneShots(reg), ...checkEncounterBursts(reg), ...checkHostilePrices(reg), ...checkKeyBreakPrices(reg),
    ...checkRepairPrices(reg), ...checkFleetPrices(reg)];
}
