/**
 * Prices carried into a later phase (#494) as pure functions of the balance table, shared by the engine, which charges
 * and displays them, and integrity, which holds every value they can take inside the band of the phase it is paid in.
 */
import type { ContentRegistry } from './registry';
import type { Action, Cost } from './schema';
import type { SiteClass } from './schemaConflict';

type Phases = Pick<ContentRegistry, 'nodes'>;

/** An action's home phase: the latest of its phase floor and the phases of the nodes it needs. Its listed price is priced there. */
export function actionHomePhase(reg: Phases, action: Action): number {
  return Math.max(action.requirements.phaseAtLeast ?? 0, ...(action.requirements.nodes ?? []).map((id) => reg.nodes.get(id)?.phaseId ?? 0));
}

/** A site class's repair is priced in the phase its domain opens in (#517), where the first raid can damage it. */
export function repairHomePhase(reg: Pick<ContentRegistry, 'world'>, cls: SiteClass): number | undefined {
  return reg.world.conflict.domains.find((domain) => domain.id === cls.domain)?.fromPhase;
}

/**
 * What a price listed for phase `home` costs when paid in `phase`: cycles and capital times every growth row after
 * `home` up to `phase`. Understanding, memory and storage are not scaled: the ladder bands only compute and money. A
 * price paid in its own phase, or earlier, is the listed price.
 */
export function priceInPhase(reg: Pick<ContentRegistry, 'balance'>, cost: Cost, home: number, phase: number): Cost {
  let cycles = 1, capital = 1;
  for (const row of reg.balance.phasePriceGrowth) {
    if (row.phase > home && row.phase <= phase) {
      cycles *= row.cycles;
      capital *= row.capital;
    }
  }
  if (cycles === 1 && capital === 1) return cost;
  return { ...cost, cycles: cost.cycles * cycles, capital: cost.capital * capital };
}
