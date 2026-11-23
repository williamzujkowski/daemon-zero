/**
 * The free-fallback invariant (#461, #488): nothing a player owns and cannot undo for free may trap a constrained
 * resource. Each row of the table (constrainedResources.ts) is checked by its rule over every permanent holding
 * (fallbackHoldings.ts); a budget row bounds a holding with its guaranteed prerequisites plus the worst every unrelated
 * permanent holding adds, so any owned set is bounded by the check of its deepest worsening holding.
 */
import { CONSTRAINED_RESOURCES, worsening, worsensAny, type ConstrainedResource } from './constrainedResources';
import { permanentHoldings, type Holding } from './fallbackHoldings';
import type { ContentRegistry, RegistryNode } from './registry';
import type { TickDelta } from './schema';

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
    // Its own compute diverted at the dial's ceiling, powered output at the grid's floor: the worst it can pay itself.
    const own = Math.max(0, holding.delta.cyclesPerSec) * (holding.delta.wattsDelta < 0 ? reg.balance.minGridEfficiency : 1);
    const pays = own * limit * usdPerFlop;
    if (pays < upkeep) problems.push(`${head} its own compute diverted pays $${fmtNumber(pays)}/s of its $${fmtNumber(upkeep)}/s upkeep`);
  }
  return problems;
}

/** Scale scrutiny's draw at `income` under the worst rule a phase at or after `floor` declares; concave, so sums bound it. */
function scrutinyDraw(reg: ContentRegistry, floor: number, income: number): number {
  if (income <= 0) return 0;
  return Math.max(0, ...reg.phases.filter((phase) => phase.phaseId >= floor).map((phase) => {
    const rule = phase.scaleScrutiny;
    return rule ? Math.min(rule.maxSuspicionPerSec, rule.suspicionPerSecAtReference * (income / rule.referenceIncomeUsdPerSec) ** rule.incomeExponent) : 0;
  }));
}

/** What `x` and its guaranteed closure add, plus the worst each unrelated permanent holding adds, in the row's worse direction. */
function budgetTotal(row: RateRow, reg: ContentRegistry, x: Holding, pool: readonly Holding[]): number {
  const key = row.rate.key, sign = row.rate.worse === 'negative' ? -1 : 1;
  const closure = pool.filter((y) => inClosure(x, y)), others = pool.filter((y) => !inClosure(x, y) && !descends(y, x));
  let total = closure.reduce((sum, y) => sum + sign * term(y, key), 0);
  if (row.budget?.scrutiny !== true) return total + others.reduce((sum, y) => sum + worsening(key, y.delta[key]), 0);
  // Net income draws scrutiny: the closure's jointly, each unrelated holding's on its own (the draw is subadditive).
  total += scrutinyDraw(reg, x.floor, closure.reduce((sum, y) => sum + term(y, 'capitalPerSec'), 0));
  const draw = (y: Holding) => scrutinyDraw(reg, Math.max(x.floor, y.floor), Math.max(0, y.delta.capitalPerSec));
  return total + others.reduce((sum, y) => sum + Math.max(0, term(y, key) + draw(y)), 0);
}

function checkBudget(row: RateRow, reg: ContentRegistry, holdings: readonly Holding[]): string[] {
  const b = reg.balance;
  const windowed = row.budget?.untilThermalRetires === true ? holdings.filter((holding) => holding.floor < b.thermalRetiresAtPhase) : holdings;
  const limit = row.budget?.limit === 'coolingHeadroom' ? (b.thermalThresholdForSuspicion - b.ambientThermal) * b.thermalDissipationPerSec : 0;
  const scrutinised = (holding: Holding) => row.budget?.scrutiny === true && holding.delta.capitalPerSec > 0 && scrutinyDraw(reg, holding.floor, 1) > 0;
  const problems: string[] = [];
  for (const x of windowed) {
    if (worsening(row.rate.key, x.delta[row.rate.key]) === 0 && !scrutinised(x)) continue;
    const total = budgetTotal(row, reg, x, windowed);
    if (total > limit + 1e-12) {
      problems.push(`${x.owner}: ${row.verb} but cannot be ${x.undo}, and with what it guarantees plus every unrelated permanent holding it adds ` +
        `${fmtNumber(total)} against a limit of ${fmtNumber(limit)}, so ${row.trap} could never be undone`);
    }
  }
  return problems;
}

/** Releasing a level takes back the memory it granted: a dismissable track must grant none, or releasing it could overfill memory. */
function checkReservation(row: ConstrainedResource, reg: ContentRegistry): string[] {
  return [...reg.repeatables.values()].filter((rep) => rep.dismissable && rep.perLevelEffects.memoryCapIncrease > 0)
    .map((rep) => `repeatable "${rep.id}": ${row.verb} and can be dismissed, so releasing a level could leave ${row.trap}`);
}

function checkUnbounded(holdings: readonly Holding[]): string[] {
  return holdings.filter((holding) => holding.unbounded === true && worsensAny(holding.delta))
    .map((holding) => `${holding.owner}: its output never expires and has no purchase limit, so what it worsens grows without bound`);
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
