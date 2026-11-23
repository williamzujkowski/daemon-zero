/**
 * The sentences a fleet battle is stated in (#518): one engagement by the square law, written out with its numbers so
 * the log, the forecast and the readout say the same thing, and the player can check the arithmetic. Pure.
 */
import { significant3 } from './amount';
import type { EngagementOutcome } from './lanchester';

const r = (value: number): string => significant3(value);

/** The engagement's square-law reasoning and outcome, in one sentence. */
export function engagementText(outcome: Pick<EngagementOutcome, 'force' | 'lethality' | 'fleet' | 'floor' | 'attackerWins' | 'forceAfter' | 'fleetAfter'>): string {
  const { force, lethality, fleet, floor, attackerWins, forceAfter, fleetAfter } = outcome;
  if (fleet <= floor) return `force ${r(force)} meets no fleet able to engage it (yours stands at ${r(fleet)}, its floor ${r(floor)}), so all of it comes through.`;
  const attackerSide = lethality * force * force, fleetSide = fleet * fleet - floor * floor;
  const law = `${r(lethality)} x ${r(force)}^2 = ${r(attackerSide)} against your fleets' ${r(fleet)}^2 - ${r(floor)}^2 = ${r(fleetSide)}`;
  return attackerWins
    ? `${law}: it is larger, so your fleets break off at ${r(floor)} and ${r(forceAfter)} of its force comes through.`
    : `${law}: it is not larger, so your fleets destroy it and keep ${r(fleetAfter)}.`;
}
