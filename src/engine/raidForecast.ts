/**
 * How a raid's battle resolves (#517, vote-1795442100055-6zz6hug): deterministic expected-value attrition, no dice and
 * no seed. A round lands the hit share T / (T + D) of its blow, never carrying the target past the damage cap, and the
 * player's offense O removes counterStrikeShare x O / (O + T) of the force the next round comes with. The tick resolves
 * each round with resolveRound, and the forecast is the same function run forward, so a forecast is exact for as long
 * as what the player holds does not change. Lanchester fleet battles (#518) are a second resolution beside this one.
 */
import type { RaidBalance } from '../content/schemaConflict';

export interface RoundInputs {
  force: number;
  defense: number;
  offense: number;
  /** Points of damage a full hit deals. */
  blow: number;
  /** The target's damage before the round. */
  damage: number;
}

export interface RoundOutcome {
  force: number;
  defense: number;
  offense: number;
  hitShare: number;
  damage: number;
  damageAfter: number;
  forceAfter: number;
}

/** The share of a raid's blow that lands against a defense: T / (T + D), so no defense makes a raid miss entirely. */
export function hitShare(force: number, defense: number): number {
  return force / (force + Math.max(0, defense));
}

/** One round, resolved. */
export function resolveRound(input: RoundInputs, balance: Pick<RaidBalance, 'damageCap' | 'counterStrikeShare'>): RoundOutcome {
  const { force, defense, offense, blow, damage } = input;
  const hit = hitShare(force, defense);
  const damageAfter = Math.min(balance.damageCap, damage + hit * blow);
  const struck = offense > 0 ? balance.counterStrikeShare * offense / (offense + force) : 0;
  return { force, defense, offense, hitShare: hit, damage: Math.max(0, damageAfter - damage), damageAfter: Math.max(damage, damageAfter),
    forceAfter: force * (1 - struck) };
}

/**
 * The rounds still to come, from a force and the target's damage now, against a defense and offense held as they are:
 * what the tick will resolve if nothing the player holds changes.
 */
export function forecastRounds(start: { force: number; damage: number }, remaining: number, held: { defense: number; offense: number; blow: number },
  balance: Pick<RaidBalance, 'damageCap' | 'counterStrikeShare'>): RoundOutcome[] {
  const out: RoundOutcome[] = [];
  let { force, damage } = start;
  for (let round = 0; round < remaining; round++) {
    const outcome = resolveRound({ force, damage, ...held }, balance);
    out.push(outcome);
    force = outcome.forceAfter;
    damage = outcome.damageAfter;
  }
  return out;
}
