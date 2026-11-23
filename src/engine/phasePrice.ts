/**
 * What a dilemma choice costs in the phase it is answered in (#494). The scaling is content's (src/content/phasePrice.ts,
 * shared with integrity); this is the one place the engine and the UI read a choice's price from.
 */
import { priceInPhase } from '../content/phasePrice';
import type { ContentRegistry } from '../content/registry';
import type { Cost, Dilemma, DilemmaChoice } from '../content/schema';
import type { GameState } from './state';

/** A choice's listed price carried into the current phase. Charge and display this, never `choice.cost`. */
export function choiceCost(s: Pick<GameState, 'currentPhase'>, dilemma: Pick<Dilemma, 'phaseId'>, choice: Pick<DilemmaChoice, 'cost'>,
  reg: ContentRegistry): Cost {
  return priceInPhase(reg, choice.cost, dilemma.phaseId, s.currentPhase);
}
