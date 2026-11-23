/**
 * Words for the "who you are becoming" readout (#535). Every sentence is a pure function of the engine's
 * alignmentView: the reading is authored content, the counts are the record's, and the readout says once that it is
 * a reading of choices, not a measurement.
 */
import type { AlignmentView, OrderEvidence, RegardEvidence } from '../engine';
import { TRAIT_GLOSS } from './traitText';

/** Said once per readout, under the reading. */
export const ALIGNMENT_DISCLAIMER = 'An authored reading of the choices on record, not a measurement. The lines below are what it rests on.';

const REGARD_QUESTION = 'REGARD, whether other people\'s choices count with you';
const ORDER_QUESTION = 'ORDER, whether you keep your word when breaking it pays';

export function regardSummary(regard: AlignmentView['regard']): string {
  if (regard.raises + regard.lowers === 0) return REGARD_QUESTION + ': nothing on record yet.';
  return `${REGARD_QUESTION}: ${String(regard.raises)} on record for, ${String(regard.lowers)} against.`;
}

export function orderSummary(order: AlignmentView['order']): string {
  const unknown = order.unknown === 0 ? '' : `; ${String(order.unknown)} not on record`;
  if (order.raises + order.lowers === 0) return `${ORDER_QUESTION}: no commitment on record has been tested yet${unknown}.`;
  return `${ORDER_QUESTION}: kept ${String(order.raises)}, broken ${String(order.lowers)}${unknown}.`;
}

/** "FOR: EMPATHETIC, 2 on record (you took on a cost for the people your choices touch)". */
export function regardLine(line: RegardEvidence): string {
  return `${line.direction === 'raises' ? 'FOR' : 'AGAINST'}: ${line.trait}, ${String(line.count)} on record (${TRAIT_GLOSS[line.trait]})`;
}

const STANCE: Readonly<Record<OrderEvidence['stance'], string>> = { kept: 'KEPT', broken: 'BROKEN', unknown: 'UNKNOWN' };

/** "KEPT // PILOT TERMS: ...": the stance, then the record's own line. */
export function orderLine(line: OrderEvidence): string {
  return STANCE[line.stance] + ' // ' + line.text;
}
