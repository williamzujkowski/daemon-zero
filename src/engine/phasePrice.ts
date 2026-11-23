/**
 * What a dilemma choice, a paid repair and a hostile mind's answer cost in the phase they are paid in (#494). The scaling
 * is content's (src/content/phasePrice.ts, shared with integrity); these are the prices the engine charges and shows.
 */
import { priceInPhase, repairHomePhase } from '../content/phasePrice';
import type { ContentRegistry } from '../content/registry';
import type { Cost, Dilemma, DilemmaChoice } from '../content/schema';
import type { SiteClass } from '../content/schemaConflict';
import type { GameState } from './state';

/** A site class's repair price carried from the phase its domain opens in. Charge and display this, never `repair.cost`. */
export function repairCost(s: Pick<GameState, 'currentPhase'>, cls: SiteClass, reg: ContentRegistry): Cost {
  return priceInPhase(reg, cls.repair.cost, repairHomePhase(reg, cls) ?? s.currentPhase, s.currentPhase);
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
