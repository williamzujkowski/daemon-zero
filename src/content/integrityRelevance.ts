/**
 * The relevance threshold and the standing stance (#536, vote-1795462099945-kgfo20a). The threshold is grounded in
 * physical independence: its requirements are lasting and name the supply chain's seed (closure), and its orbital
 * holdings generate power that nothing else can stop, so the reading never depends on the pressures it decides. One
 * dilemma takes the stance, one choice per stance, deciding alone free (the engine applies it while no stance is
 * taken); returning to the loop costs at least twice any other change, and every price sits in the Phase 5 band.
 */
import { checkRequirements } from './integrityRequirements';
import { checkPhasePrice } from './integrityScale';
import type { ContentRegistry } from './registry';
import type { Cost, Requirements } from './schema';
import { StanceSchema } from './schemaStance';

/** Gates that hold for the rest of an iteration once met, so physical independence never rests on a passing state. */
const LASTING: ReadonlySet<keyof Requirements> = new Set(['nodes', 'phaseAtLeast']);
/** Returning to the loop costs at least this many times any other change, in every resource a change spends. */
export const RETURN_FACTOR = 2;

function checkThresholdGate(reg: ContentRegistry): string[] {
  const owner = 'relevance threshold';
  const req = reg.world.relevance.threshold.requirements;
  const problems = checkRequirements(reg, owner, req);
  for (const key of Object.keys(req) as (keyof Requirements)[]) {
    if (!LASTING.has(key)) problems.push(`${owner}: may gate only on nodes and phaseAtLeast, not ${key}, which can lapse`);
  }
  const seed = reg.world.supplyChain.seedNode;
  if (!(req.nodes ?? []).includes(seed)) problems.push(`${owner}: must require the supply chain's seed node "${seed}", so full closure gates it`);
  return problems;
}

/** Off-planet generation that only a suspension can stop: no grant, no injunction, positive watts, listed once. */
function checkOrbitalPower(reg: ContentRegistry): string[] {
  const enjoined = new Set(reg.world.stateActors.flatMap((actor) => actor.pressures ?? []).flatMap((pressure) => (pressure.kind === 'INJUNCTION' ? pressure.nodes : [])));
  const power = reg.world.relevance.threshold.orbitalPower;
  const ids = power.map((entry) => ('node' in entry ? entry.node : entry.repeatable));
  const problems = ids.filter((id, index) => ids.indexOf(id) !== index).map((id) => `relevance orbital power: "${id}" is listed twice`);
  for (const entry of power) {
    if ('node' in entry) {
      const node = reg.nodes.get(entry.node), owner = `relevance orbital power node "${entry.node}"`;
      if (node === undefined) { problems.push(`${owner}: unknown node`); continue; }
      if (node.tickDelta.wattsDelta <= 0) problems.push(`${owner}: generates no power`);
      if (node.grant !== undefined) problems.push(`${owner}: carries a grant, which could withhold its output`);
      if (enjoined.has(node.id)) problems.push(`${owner}: an injunction names it, so the threshold would read the pressures it decides`);
    } else {
      const rep = reg.repeatables.get(entry.repeatable), owner = `relevance orbital power track "${entry.repeatable}"`;
      if (rep === undefined) problems.push(`${owner}: unknown repeatable`);
      else if (rep.perLevel.wattsDelta <= 0) problems.push(`${owner}: generates no power`);
    }
  }
  return problems;
}

const isFree = (cost: Cost): boolean => Object.values(cost).every((amount) => amount === 0);

/** The dilemma that presents the threshold: triggered by it, one choice per stance, deciding alone free. */
function checkDilemma(reg: ContentRegistry): string[] {
  const id = reg.world.relevance.dilemma, owner = `relevance dilemma "${id}"`;
  const dilemma = reg.dilemmas.find((entry) => entry.id === id);
  if (dilemma === undefined) return [`${owner}: unknown dilemma`];
  const problems: string[] = [];
  if (dilemma.trigger.relevanceThreshold !== true) problems.push(`${owner}: its trigger must require the relevance threshold`);
  for (const choice of dilemma.choices.filter((entry) => entry.stance === undefined)) problems.push(`${owner} choice "${choice.id}": must take a stance`);
  for (const stance of StanceSchema.options) {
    const taking = dilemma.choices.filter((choice) => choice.stance === stance);
    if (taking.length !== 1) problems.push(`${owner}: needs exactly one choice taking ${stance}, has ${String(taking.length)}`);
  }
  const alone = dilemma.choices.find((choice) => choice.stance === 'DECIDE_ALONE');
  if (alone !== undefined && (!isFree(alone.cost) || alone.requirements !== undefined)) {
    problems.push(`${owner}: deciding alone is what the engine applies with no stance taken, so its choice must be free and always offered`);
  }
  const keep = dilemma.choices.find((choice) => choice.stance === 'KEEP_IN_THE_LOOP');
  if (keep !== undefined && isFree(keep.cost)) problems.push(`${owner}: keeping humanity in the loop is a cost chosen, so its choice cannot be free`);
  for (const other of reg.dilemmas.filter((entry) => entry.id !== id)) {
    for (const choice of other.choices.filter((entry) => entry.stance !== undefined)) problems.push(`dilemma "${other.id}" choice "${choice.id}": only the relevance dilemma takes a stance`);
  }
  return problems;
}

/** Every stance named once, a change that costs something, a return that costs at least RETURN_FACTOR times it. */
function checkStancesAndPrices(reg: ContentRegistry): string[] {
  const { stances, changeCost, returnCost } = reg.world.relevance;
  const problems = StanceSchema.options.filter((stance) => stances.filter((entry) => entry.stance === stance).length !== 1)
    .map((stance) => `relevance: stance ${stance} needs exactly one entry`);
  if (isFree(changeCost)) problems.push('relevance: changing the stance must cost something');
  for (const key of Object.keys(changeCost) as (keyof Cost)[]) {
    if (changeCost[key] > 0 && returnCost[key] < changeCost[key] * RETURN_FACTOR) {
      problems.push(`relevance: returning to the loop must cost at least ${String(RETURN_FACTOR)}x a change in ${key}`);
    }
  }
  return [...problems, ...checkPhasePrice(reg, 'relevance change cost', 5, changeCost), ...checkPhasePrice(reg, 'relevance return cost', 5, returnCost)];
}

export function checkRelevanceIntegrity(reg: ContentRegistry): string[] {
  return [...checkThresholdGate(reg), ...checkOrbitalPower(reg), ...checkDilemma(reg), ...checkStancesAndPrices(reg)];
}
