/**
 * What a dilemma choice, a paid repair and a hostile mind's answer cost in the phase they are paid in (#494). The scaling
 * is content's (src/content/phasePrice.ts, shared with integrity); these are the prices the engine charges and shows.
 */
import { fleetHomePhase, priceInPhase, repairHomePhase } from '../content/phasePrice';
import type { ContentRegistry } from '../content/registry';
import type { Cost, Dilemma, DilemmaChoice } from '../content/schema';
import type { DeviantRaid, SiteClass } from '../content/schemaConflict';
import type { FleetUnit } from '../content/schemaFleets';
import type { GameState } from './state';

/** A site class's repair price carried from the phase its domain opens in. Charge and display this, never `repair.cost`. */
export function repairCost(s: Pick<GameState, 'currentPhase'>, cls: SiteClass, reg: ContentRegistry): Cost {
  return priceInPhase(reg, cls.repair.cost, repairHomePhase(reg, cls) ?? s.currentPhase, s.currentPhase);
}

/** A fleet's paid rebuild carried from its track's phase (#518). */
export function fleetRebuildCost(s: Pick<GameState, 'currentPhase'>, unit: FleetUnit, reg: ContentRegistry): Cost {
  return priceInPhase(reg, unit.rebuild.cost, fleetHomePhase(reg, unit.repeatable) ?? s.currentPhase, s.currentPhase);
}

/** A deviant's reclaim carried from its fleet's track phase (#518); nothing for a raid that is not a deviant. */
export function reclaimCost(s: Pick<GameState, 'currentPhase'>, kind: DeviantRaid, reg: ContentRegistry): Cost {
  return priceInPhase(reg, kind.reclaim.cost, fleetHomePhase(reg, kind.fleet) ?? s.currentPhase, s.currentPhase);
}

/** A hostile mind's answer price carried from its tier's phase (#491). */
export function tierCost(s: Pick<GameState, 'currentPhase'>, cost: Cost, tier: number, reg: ContentRegistry): Cost {
  return priceInPhase(reg, cost, tier, s.currentPhase);
}

/** A choice's listed price carried into the current phase. Charge and display this, never `choice.cost`. */
export function choiceCost(s: Pick<GameState, 'currentPhase'>, dilemma: Pick<Dilemma, 'phaseId'>, choice: Pick<DilemmaChoice, 'cost'>,
  reg: ContentRegistry): Cost {
  return priceInPhase(reg, choice.cost, dilemma.phaseId, s.currentPhase);
}
