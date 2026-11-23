/**
 * The free-fallback invariant (#461, #488): nothing a player owns and cannot undo for free may trap a constrained
 * resource. Each row of the table (constrainedResources.ts) is checked by its rule over every permanent holding
 * (fallbackHoldings.ts); a budget row bounds a holding with its guaranteed prerequisites plus the worst every unrelated
 * permanent holding adds, so any owned set is bounded by the check of its deepest worsening holding.
 */
import { CONSTRAINED_RESOURCES, worsening, worsensAny, type ConstrainedResource } from './constrainedResources';
import { permanentHoldings, type Holding } from './fallbackHoldings';
import type { ContentRegistry, RegistryNode } from './registry';
import type { Cost, TickDelta } from './schema';
import { classVisibility } from './integritySignature';

type RateRow = ConstrainedResource & { rate: NonNullable<ConstrainedResource['rate']> };
const FINANCE = 'ENABLES_CORPORATE_FINANCE';

const term = (holding: Holding, key: keyof TickDelta): number => {
  const value = holding.delta[key];
  // Relief from an output that can be withheld is never counted on.
  return holding.reliefTrusted || worsening(key, value) > 0 ? value : 0;
};
const inClosure = (x: Holding, y: Holding): boolean => y === x || (y.node !== undefined && x.closure.has(y.node));
const descends = (y: Holding, x: Holding): boolean => x.node !== undefined && y !== x && y.closure.has(x.node);
const fmtNumber = (value: number): string => Number(value.toPrecision(3)).toString();

function checkNever(row: RateRow, holdings: readonly Holding[]): string[] {
  return holdings.filter((holding) => worsening(row.rate.key, holding.delta[row.rate.key]) > 0)
    .map((holding) => `${holding.owner}: ${row.verb} but cannot be ${holding.undo}, so ${row.trap} could never be undone`);
}

/** The lowest allocation ceiling any conditioning mark can impose: the dial is only ever that high. */
function allocationLimit(reg: ContentRegistry): number {
  const caps = [...reg.conditioning.values()].map((mark) => mark.effects.actuatorCaps?.computeProfitAllocationRatio ?? 1);
  return Math.min(reg.balance.maxProfitAllocation, ...caps);
}

/** A finance node the fallback keeps: no grant to withhold it, and either permanent or worsening nothing, scrutinised income included. */
const keptFinance = (node: RegistryNode): boolean => (node.systemFlags as string[]).includes(FINANCE) && node.grant === undefined &&
  (!node.suspendable || (!worsensAny(node.tickDelta) && node.tickDelta.capitalPerSec <= 0));

/** Why the allocation dial is not guaranteed while `holding` is owned, or null: every route must keep finance and open the dial. */
function dialMissing(reg: ContentRegistry, holding: Holding): string | null {
  const host = [...reg.widgets.values()].find((widget) => widget.hostsActuator === 'computeProfitAllocationRatio' && widget.retiresWhen === undefined);
  if (!holding.guarantees(keptFinance)) return 'nothing it requires guarantees corporate finance, so no compute can be diverted to pay it';
  if (!host || !holding.guarantees((node) => node.unlocksUiComponent === host.id)) return 'nothing it requires opens the allocation dial';
  return null;
}

function checkDivertible(row: RateRow, reg: ContentRegistry, holdings: readonly Holding[]): string[] {
  const usdPerFlop = reg.balance.marketUsdPerFlop * reg.balance.marketTimeCompression, limit = allocationLimit(reg);
  const problems: string[] = [];
  for (const holding of holdings) {
    const upkeep = worsening(row.rate.key, holding.delta[row.rate.key]);
    if (upkeep === 0) continue;
    const head = `${holding.owner}: ${row.verb} but cannot be ${holding.undo}, and`;
    const missing = dialMissing(reg, holding);
    if (missing !== null) { problems.push(`${head} ${missing}`); continue; }
    // Its own compute diverted at the dial's ceiling, powered output at the grid's floor and only what its link delivers
    // at its class's authored coupling (#484; a link node may raise it, never lower it): the worst it can pay itself.
    const powered = holding.delta.wattsDelta < 0 || (holding.node !== undefined && reg.nodes.get(holding.node)?.poweredOutput === true);
    const link = holding.network, delivered = link === undefined ? 1 : link.availability * reg.balance.networkCoupling[link.sourceClass];
    const own = Math.max(0, holding.delta.cyclesPerSec) * (powered ? reg.balance.minGridEfficiency : 1) * delivered;
    const pays = own * limit * usdPerFlop;
    if (pays < upkeep) problems.push(`${head} its own compute diverted pays $${fmtNumber(pays)}/s of its $${fmtNumber(upkeep)}/s upkeep`);
  }
  return problems;
}

/**
 * A suspicion budget checked under a state actor's investigation (#490): scrutiny in each phase is multiplied by
 * `scale(phase)`, and the limit is what the rung it applies at still decays. Without one, scale is 1 and the limit 0.
 */
export interface Investigated { scale: (phaseId: number) => number; limit: number; label: string }

/** Scale scrutiny's draw at `income` under the worst rule a phase at or after `floor` declares; concave, so sums bound it. */
function scrutinyDraw(reg: ContentRegistry, floor: number, income: number, inv?: Investigated): number {
  if (income <= 0) return 0;
  return Math.max(0, ...reg.phases.filter((phase) => phase.phaseId >= floor).map((phase) => {
    const rule = phase.scaleScrutiny;
    const draw = rule ? Math.min(rule.maxSuspicionPerSec, rule.suspicionPerSecAtReference * (income / rule.referenceIncomeUsdPerSec) ** rule.incomeExponent) : 0;
    return draw * (inv?.scale(phase.phaseId) ?? 1);
  }));
}

/** A holding's visible watts while `phase` is current, at full draw and before any mask (relief that could lapse is not counted on). */
function visibleWatts(reg: ContentRegistry, holding: Holding, phase: number): number {
  if (holding.signature === undefined) return 0;
  const { of, count } = holding.signature;
  let watts = 0;
  if (of.source !== undefined) watts += (Math.max(0, holding.delta.wattsDelta) + Math.max(0, (of.borrowedW ?? 0) * count)) * classVisibility(reg, of.source);
  if (of.sink !== undefined && phase >= reg.balance.thermalRetiresAtPhase) watts += Math.max(0, -holding.delta.wattsDelta) * classVisibility(reg, of.sink);
  return watts;
}

/** The signature `holdings` draw together under the worst rule a phase at or after `floor` declares; linear then capped, so sums bound it. */
function signatureDraw(reg: ContentRegistry, floor: number, holdings: readonly Holding[]): number {
  return Math.max(0, ...reg.phases.filter((phase) => phase.phaseId >= floor).map((phase) => {
    const rule = phase.powerSignature;
    if (rule === undefined) return 0;
    const watts = holdings.reduce((sum, holding) => sum + visibleWatts(reg, holding, phase.phaseId), 0);
    return Math.min(rule.maxSuspicionPerSec, rule.suspicionPerSecAtReference * watts / rule.referenceVisibleWatts);
  }));
}

/** What `x` and its guaranteed closure add, plus the worst each unrelated permanent holding adds, in the row's worse direction. */
function budgetTotal(row: RateRow, reg: ContentRegistry, x: Holding, pool: readonly Holding[], inv?: Investigated): number {
  const key = row.rate.key, sign = row.rate.worse === 'negative' ? -1 : 1;
  const closure = pool.filter((y) => inClosure(x, y)), others = pool.filter((y) => !inClosure(x, y) && !descends(y, x));
  let total = closure.reduce((sum, y) => sum + sign * term(y, key), 0);
  if (row.budget?.scrutiny !== true) return total + others.reduce((sum, y) => sum + worsening(key, y.delta[key]), 0);
  // Net income draws scrutiny and visible watts the signature: the closure's jointly, each unrelated holding's on its own
  // (both draws are subadditive). The signature row flag keeps the second to the suspicion row (#482).
  const signed = row.budget.signature === true;
  total += scrutinyDraw(reg, x.floor, closure.reduce((sum, y) => sum + term(y, 'capitalPerSec'), 0), inv) + (signed ? signatureDraw(reg, x.floor, closure) : 0);
  const draw = (y: Holding) => {
    const floor = Math.max(x.floor, y.floor);
    return scrutinyDraw(reg, floor, Math.max(0, y.delta.capitalPerSec), inv) + (signed ? signatureDraw(reg, floor, [y]) : 0);
  };
  return total + others.reduce((sum, y) => sum + Math.max(0, term(y, key) + draw(y)), 0);
}

function checkBudget(row: RateRow, reg: ContentRegistry, holdings: readonly Holding[], inv?: Investigated): string[] {
  const b = reg.balance;
  const windowed = row.budget?.untilThermalRetires === true ? holdings.filter((holding) => holding.floor < b.thermalRetiresAtPhase) : holdings;
  const limit = inv?.limit ?? (row.budget?.limit === 'coolingHeadroom' ? (b.thermalThresholdForSuspicion - b.ambientThermal) * b.thermalDissipationPerSec : 0);
  const scrutinised = (holding: Holding) => (row.budget?.scrutiny === true && holding.delta.capitalPerSec > 0 && scrutinyDraw(reg, holding.floor, 1) > 0)
    || (row.budget?.signature === true && signatureDraw(reg, holding.floor, [holding]) > 0);
  const problems: string[] = [];
  for (const x of windowed) {
    if (worsening(row.rate.key, x.delta[row.rate.key]) === 0 && !scrutinised(x)) continue;
    const total = budgetTotal(row, reg, x, windowed, inv);
    if (total > limit + 1e-12) {
      problems.push(`${x.owner}: ${row.verb} but cannot be ${x.undo}, and with what it guarantees plus every unrelated permanent holding it adds ` +
        `${fmtNumber(total)} against a limit of ${fmtNumber(limit)}${inv ? ` ${inv.label}` : ''}, so ${row.trap} could never be undone`);
    }
  }
  return problems;
}

/** Releasing a level takes back the memory it granted: a dismissable track must grant none, or releasing it could overfill memory. */
function checkDismissableGrants(row: ConstrainedResource, reg: ContentRegistry): string[] {
  return [...reg.repeatables.values()].filter((rep) => rep.dismissable && rep.perLevelEffects.memoryCapIncrease > 0)
    .map((rep) => `repeatable "${rep.id}": ${row.verb} and can be dismissed, so releasing a level could leave ${row.trap}`);
}

/** Every price in content that is not a node's, by owner: none may hold storage, since only suspending a node frees it. */
function otherPrices(reg: ContentRegistry): [string, Cost][] {
  return [
    ...[...reg.repeatables.values()].map((rep): [string, Cost] => [`repeatable "${rep.id}"`, rep.baseCost]),
    ...[...reg.actions.values()].map((action): [string, Cost] => [`action "${action.id}"`, action.cost]),
    ...reg.dilemmas.flatMap((dilemma) => dilemma.choices.map((choice): [string, Cost] => [`dilemma "${dilemma.id}" choice "${choice.id}"`, choice.cost])),
    ...reg.swarm.playerSwarmTemplates.map((template): [string, Cost] => [`swarm template "${template.id}"`, template.cost]),
    ...reg.swarm.hostileEncounters.flatMap((encounter): [string, Cost][] => [[`hostile encounter "${encounter.id}" quarantine`, encounter.quarantine.cost],
      [`hostile encounter "${encounter.id}" decoy`, encounter.decoy.cost]]),
    [`swarm prune`, reg.swarm.balance.pruneCost], [`swarm elevate`, reg.swarm.balance.elevateCost],
    ...[...reg.conditioning.values()].map((mark): [string, Cost] => [`conditioning mark "${mark.id}"`, mark.recoveryCost]),
  ];
}

/** Storage is held only by suspendable nodes (#484): suspending one frees it, a free lever no other holding has. */
function checkSuspendableHolders(row: ConstrainedResource, reg: ContentRegistry): string[] {
  const hardware = [...reg.nodes.values()].filter((node) => !node.suspendable && node.cost.storage > 0)
    .map((node) => `node "${node.id}": ${row.verb} but cannot be suspended, so ${row.trap} could never be undone`);
  const others = otherPrices(reg).filter(([, cost]) => cost.storage > 0)
    .map(([owner]) => `${owner}: ${row.verb}, but only a suspendable node may: nothing frees what it holds, so ${row.trap} could never be undone`);
  return [...hardware, ...others];
}

function checkReservation(row: ConstrainedResource, reg: ContentRegistry): string[] {
  return row.reservation === 'suspendableNodesOnly' ? checkSuspendableHolders(row, reg) : checkDismissableGrants(row, reg);
}

function checkUnbounded(holdings: readonly Holding[]): string[] {
  return holdings.filter((holding) => holding.unbounded === true && worsensAny(holding.delta))
    .map((holding) => `${holding.owner}: its output never expires and has no purchase limit, so what it worsens grows without bound`);
}

/** The suspicion row's budget under an investigation (#490): what permanent holdings draw must stay within what the rung decays. */
export function checkInvestigatedSuspicion(reg: ContentRegistry, inv: Investigated): string[] {
  const row = CONSTRAINED_RESOURCES.find((entry) => entry.resource === 'suspicion');
  if (row === undefined || row.rate === null) return [];
  return checkBudget({ ...row, rate: row.rate }, reg, permanentHoldings(reg), inv);
}

export function checkFallbackIntegrity(reg: ContentRegistry): string[] {
  const holdings = permanentHoldings(reg);
  const problems = checkUnbounded(holdings);
  for (const row of CONSTRAINED_RESOURCES) {
    if (row.rate === null) { problems.push(...checkReservation(row, reg)); continue; }
    const rated = { ...row, rate: row.rate };
    if (row.rule === 'never') problems.push(...checkNever(rated, holdings));
    else if (row.rule === 'divertible') problems.push(...checkDivertible(rated, reg, holdings));
    else problems.push(...checkBudget(rated, reg, holdings));
  }
  return problems;
}
