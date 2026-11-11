import { meetsRequirements } from '../query';
import { fmt, pushLog } from '../util';
import type { TickSystem } from './types';

/**
 * Raises the first unresolved dilemma whose trigger is met. Setting
 * activeDilemmaId freezes the clock (see tick.ts) until the player chooses.
 * Dilemmas never fire while dormant: nobody should return to a decision made for them.
 */
export const evaluateDilemmas: TickSystem = (d, { reg, dormant }) => {
  if (dormant || d.activeDilemmaId !== null) return undefined;
  const next = reg.dilemmas.find(
    (dilemma) =>
      dilemma.phaseId <= d.currentPhase &&
      !d.resolvedDilemmas.includes(dilemma.id) &&
      meetsRequirements(d, dilemma.trigger),
  );
  if (!next) return undefined;
  d.activeDilemmaId = next.id;
  pushLog(d, reg, fmt(reg.narrative.dilemmaInterrupt, { title: next.title }), 'WARN');
  return undefined;
};
