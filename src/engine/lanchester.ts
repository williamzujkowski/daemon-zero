/**
 * The Lanchester square law for fleet battles (#518, vote-1795442100055-6zz6hug): deterministic, no dice and no seed.
 * An attacking force A at lethality L (its effectiveness per unit of strength against one of the player's) meets the
 * player's fleet strength B, which breaks off at its floor F (no fleet is ever cut past the lossCap). Under the square
 * law L x A^2 - B^2 never changes as they fight, so the outcome is known before a shot is fired:
 *
 * - the attacker wins exactly when L x A^2 > B^2 - F^2, and comes through with sqrt(A^2 - (B^2 - F^2) / L) while the
 *   fleet stands at its floor;
 * - otherwise the attacker is destroyed and the fleet keeps sqrt(B^2 - L x A^2), never under its floor.
 *
 * A fleet already at or under its floor does not engage: the attacker passes it untouched.
 */

export interface EngagementInputs {
  force: number;
  lethality: number;
  fleet: number;
  floor: number;
}

export interface EngagementOutcome extends EngagementInputs {
  /** L x A^2: the attacker's side of the square law. */
  attackerSide: number;
  /** B^2 - F^2: what the fleet can spend before it breaks off. */
  fleetSide: number;
  attackerWins: boolean;
  forceAfter: number;
  fleetAfter: number;
}

/** One engagement, resolved by the square law. */
export function engage(input: EngagementInputs): EngagementOutcome {
  const { force, lethality, fleet, floor } = input;
  const stands = Math.max(0, fleet), breaks = Math.min(stands, Math.max(0, floor));
  const attackerSide = lethality * force * force, fleetSide = stands * stands - breaks * breaks;
  if (attackerSide > fleetSide) {
    return { ...input, attackerSide, fleetSide, attackerWins: true, forceAfter: Math.sqrt(force * force - fleetSide / lethality), fleetAfter: breaks };
  }
  return { ...input, attackerSide, fleetSide, attackerWins: false, forceAfter: 0, fleetAfter: Math.sqrt(stands * stands - attackerSide) };
}
