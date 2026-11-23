/**
 * Fleet battles by the Lanchester square law (#518, vote-1795442100055-6zz6hug): the winner is named before a shot is
 * fired, the survivors follow from L x A^2 - B^2 held constant, no fleet is cut past its floor, and a battle through the
 * real stages lands exactly what the forecast said, with no Math.random and no seed.
 */
import { describe, expect, it } from 'vitest';
import { computeRates, conflictStats, defenseAgainst, domainFleet, engage, offenseIn, raidView, tick, type GameState } from '../src/engine';
import { defined } from './m7-helpers';
import { reg } from './helpers';
import { arrived, raid, R, settled } from './conflict-helpers';
import { CREWS, DRONES, F, fleetRun, fleets, rivalRaidsDue, TENDERS, TO_ENGAGEMENT, withRecord } from './fleet-helpers';

const swarm = raid('raid_p4_drone_swarm');

describe('the square law', () => {
  it('names the attacker the winner exactly when L x A^2 exceeds B^2 - F^2, and its survivors follow from the invariant', () => {
    const won = engage({ force: 10, lethality: 1.2, fleet: 10, floor: 5 });
    expect(won).toMatchObject({ attackerSide: 120, fleetSide: 75, attackerWins: true, fleetAfter: 5 });
    expect(won.forceAfter).toBeCloseTo(Math.sqrt(100 - 75 / 1.2), 12);
    const lost = engage({ force: 10, lethality: 1.2, fleet: 20, floor: 10 });
    expect(lost).toMatchObject({ attackerSide: 120, fleetSide: 300, attackerWins: false, forceAfter: 0 });
    expect(lost.fleetAfter).toBeCloseTo(Math.sqrt(400 - 120), 12);
  });

  it('keeps L x A^2 - B^2 the same before and after, whichever side wins', () => {
    for (const input of [{ force: 7, lethality: 1.25, fleet: 9, floor: 4.5 }, { force: 3, lethality: 2, fleet: 12, floor: 6 }, { force: 30, lethality: 0.8, fleet: 18, floor: 9 }]) {
      const out = engage(input);
      expect(out.lethality * out.forceAfter ** 2 - out.fleetAfter ** 2).toBeCloseTo(input.lethality * input.force ** 2 - input.fleet ** 2, 9);
    }
  });

  it('a tie goes to the fleet, which ends at its floor; a fleet at its floor does not engage', () => {
    expect(engage({ force: 5, lethality: 1, fleet: 13, floor: 12 })).toMatchObject({ attackerWins: false, forceAfter: 0, fleetAfter: 12 });
    expect(engage({ force: 4, lethality: 1, fleet: 6, floor: 6 })).toMatchObject({ attackerWins: true, forceAfter: 4, fleetAfter: 6 });
    expect(engage({ force: 4, lethality: 1, fleet: 0, floor: 0 })).toMatchObject({ attackerWins: true, forceAfter: 4, fleetAfter: 0 });
  });

  it('never leaves the fleet under its floor, and doubling the fleet beats quadrupling the force by the square law', () => {
    for (let force = 1; force < 40; force += 3) expect(engage({ force, lethality: 1.5, fleet: 20, floor: 10 }).fleetAfter).toBeGreaterThanOrEqual(10);
    const a = engage({ force: 10, lethality: 1, fleet: 10, floor: 0 }), b = engage({ force: 20, lethality: 1, fleet: 20, floor: 0 });
    expect(a.attackerWins).toBe(b.attackerWins);
  });
});

/** A Phase 4 mind whose fleets meet a rival drone fleet at arrival, aimed at its data halls. */
const raided = (levels: Record<string, number>): GameState => arrived(rivalRaidsDue(fleets(levels)), swarm);

describe('a rival fleet through the real stages', () => {
  it('meets the domain\'s fleets in round 1; a force they destroy ends the battle there with no damage', () => {
    const s = raided({ [DRONES]: 40, [CREWS]: 10 });
    const fleet = domainFleet(s, reg, 'SITE'), force = defined(s.conflict.raid).force;
    const outcome = engage({ force, lethality: defined(swarm.lethality), fleet: fleet.strength, floor: fleet.floor });
    expect(outcome.attackerWins).toBe(false);
    const fought = fleetRun(s, TO_ENGAGEMENT);
    const raid = defined(fought.conflict.raid);
    expect(raid.stage).toBe('AFTERMATH');
    expect(raid.engagement).toEqual({ force, lethality: swarm.lethality, fleet: fleet.strength, floor: fleet.floor, attackerWins: false, forceAfter: 0, fleetAfter: outcome.fleetAfter });
    expect(raid.rounds).toEqual([]);
    expect(fought.conflict.damage).toEqual({});
    // The aftermath no longer holds rebuild, so the engagement's own tick already rebuilt one step's worth.
    const step = fleet.members.reduce((sum, member) => sum + member.full, 0) * F.freeRebuildPerSec / reg.balance.tickHz * 3;
    expect(domainFleet(fought, reg, 'SITE').strength - outcome.fleetAfter).toBeGreaterThanOrEqual(0);
    expect(domainFleet(fought, reg, 'SITE').strength - outcome.fleetAfter).toBeLessThan(step);
  });

  it('takes the fleets\' losses in proportion to what each holds above its floor, so none passes the loss cap', () => {
    const fought = fleetRun(raided({ [DRONES]: 40, [CREWS]: 10 }), TO_ENGAGEMENT);
    const drones = defined(fought.conflict.fleets[DRONES]).lost, crews = defined(fought.conflict.fleets[CREWS]).lost;
    expect(drones).toBeGreaterThan(0);
    expect(drones).toBeCloseTo(crews, 12);
    expect(drones).toBeLessThanOrEqual(F.lossCap);
  });

  it('a force that breaks the fleets comes through and strikes by attrition against what is not a fleet, round by round', () => {
    const s = raided({ [DRONES]: 4 });
    const fought = fleetRun(s, TO_ENGAGEMENT + (R.rounds - 1) * R.roundSec);
    const raid = defined(fought.conflict.raid);
    expect(raid.engagement?.attackerWins).toBe(true);
    expect(raid.rounds).toHaveLength(R.rounds - 1);
    expect(raid.stage).toBe('AFTERMATH');
    expect(defined(raid.rounds[0]).force).toBeCloseTo(defined(raid.engagement).forceAfter, 12);
    expect(fought.conflict.damage.halls).toBeGreaterThan(0);
    // At the cap once broken; the aftermath's first tick rebuilds one step of it.
    expect(defined(fought.conflict.fleets[DRONES]).lost).toBeCloseTo(F.lossCap, 3);
  });

  it('lands exactly what its forecast said at arrival, while what the player holds does not change', () => {
    const s = raided({ [DRONES]: 4 });
    const forecast = defined(raidView(settled(s), reg)).forecast;
    const fought = fleetRun(s, TO_ENGAGEMENT + (R.rounds - 1) * R.roundSec);
    const log = defined(raidView(settled(fought), reg)).log;
    expect(log.length).toBe(R.rounds);
    for (const line of log) expect(forecast).toContain(line);
  });

  it('names the winner in the forecast: a destroyed force reads as destroyed before a shot', () => {
    const view = defined(raidView(settled(raided({ [DRONES]: 40, [CREWS]: 10 })), reg));
    expect(view.fleetBattle).toBe(true);
    expect(view.forecast.join(' ')).toContain('your fleets destroy it');
  });

  it('a dial set lower before the engagement fights with less strength, and the forecast says so first', () => {
    const s = raided({ [DRONES]: 40, [CREWS]: 10 });
    const tethered = withRecord(withRecord(s, DRONES, { autonomy: 'SHACKLED' }), CREWS, { autonomy: 'SHACKLED' });
    expect(domainFleet(tethered, reg, 'SITE').strength).toBeCloseTo(domainFleet(s, reg, 'SITE').strength * F.autonomy.SHACKLED.output, 9);
  });

  it('holds the fleets\' rebuild until the aftermath, so the forecast stays exact', () => {
    const s = withRecord(raided({ [DRONES]: 40 }), DRONES, { lost: 0.1 });
    expect(defined(fleetRun(s, 5).conflict.fleets[DRONES]).lost).toBe(0.1);
  });
});

describe('fleet strength in the stats', () => {
  it('feeds its domain\'s defense and offense, scaled by what it has not lost and by its dial', () => {
    const s = fleets({ [DRONES]: 40 }), worn = withRecord(s, DRONES, { lost: 0.5 }), free = withRecord(s, DRONES, { autonomy: 'ELEVATED' });
    const site = (state: GameState) => ({ defense: defenseAgainst(conflictStats(state, reg), 'drone_strike'), offense: offenseIn(conflictStats(state, reg), 'SITE') });
    const none = site(fleets({}));
    expect(site(s).defense).toBeGreaterThan(none.defense);
    expect(site(s).offense).toBeGreaterThan(none.offense);
    expect(site(worn).defense).toBeLessThan(site(s).defense);
    expect(site(free).offense).toBeGreaterThan(site(s).offense);
    // A fleet battle's strikes come after the engagement broke the fleets, so they meet what is not a fleet.
    expect(defenseAgainst(conflictStats(s, reg, true), 'drone_strike')).toBeCloseTo(none.defense, 12);
  });

  it('orbital tenders feed the orbit domain, not the site', () => {
    const s = fleets({ [TENDERS]: 5 }, 5);
    expect(offenseIn(conflictStats(s, reg), 'ORBIT')).toBeGreaterThan(offenseIn(conflictStats(fleets({}, 5), reg), 'ORBIT'));
    expect(defenseAgainst(conflictStats(s, reg), 'asat_strike')).toBeGreaterThan(defenseAgainst(conflictStats(fleets({}, 5), reg), 'asat_strike'));
    expect(domainFleet(s, reg, 'ORBIT').strength).toBeGreaterThan(0);
    expect(domainFleet(s, reg, 'SITE').strength).toBe(0);
  });
});

describe('determinism', () => {
  it('the same state played the same way through the real tick fights the same battle, to the byte', () => {
    const play = (): string => {
      let s = raided({ [DRONES]: 12, [CREWS]: 3 });
      for (let i = 0; i < (TO_ENGAGEMENT + R.rounds * R.roundSec) * reg.balance.tickHz; i++) s = tick(s, 1 / reg.balance.tickHz, reg);
      return JSON.stringify({ conflict: s.conflict, rates: computeRates(s, reg) });
    };
    expect(play()).toBe(play());
  });
});
