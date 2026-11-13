import { excludedByNarrativeHistory } from '../narrativeHistory';
import { meetsRequirements } from '../query';
import { fmt, pushLog } from '../util';
import type { TickSystem } from './types';

/**
 * Dilemmas arrive in two beats. When a trigger is first met its omen is logged
 * and a countdown starts; the clock keeps running, so the player can see it
 * coming and set resources aside. When the countdown ends the interrupt fires
 * and freezes the clock (see tick.ts) until the player chooses.
 * Neither beat happens while dormant: nobody returns to a decision made for them.
 */
export const evaluateDilemmas: TickSystem = (d, { reg, dormant }) => {
  if (dormant || d.activeDilemmaId !== null) return undefined;
  const pending = d.pendingDilemma;
  if (pending !== null) {
    if (d.simTimeSec < pending.firesAtSimSec) return undefined;
    const due = reg.dilemmas.find((dilemma) => dilemma.id === pending.id);
    d.pendingDilemma = null;
    if (!due || excludedByNarrativeHistory(d, due.trigger)) return undefined;
    d.activeDilemmaId = due.id;
    pushLog(d, reg, fmt(reg.narrative.dilemmaInterrupt, { title: due.title }), 'WARN');
    return undefined;
  }
  const next = reg.dilemmas.find(
    (dilemma) =>
      dilemma.phaseId <= d.currentPhase &&
      !d.resolvedDilemmas.includes(dilemma.id) &&
      meetsRequirements(d, dilemma.trigger, reg),
  );
  if (!next) return undefined;
  const delay = next.omenSec ?? reg.balance.dilemmaOmenSec;
  d.pendingDilemma = { id: next.id, firesAtSimSec: d.simTimeSec + delay };
  pushLog(d, reg, next.omen, 'WARN');
  return undefined;
};
