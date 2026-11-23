/**
 * Drift deviants (#518, vote-1795442211574-efkot02): a fleet drifts in proportion to its running size times the autonomy
 * dial, through the machinery cohorts use; more autonomy yields more and drifts more; lowering the dial is free and stops
 * drift; past the split a share turns deviant and raids through the hostile slot; it can be reclaimed for a price before
 * its battle or destroyed in it; losses are rebuilt by the fabs, free but slow, faster if paid; and nothing passes a cap.
 */
import { describe, expect, it } from 'vitest';
import {
  cohortAutonomy, computeRates, conflictReadout, domainFleet, fleetDriftPerSec, fleetReadout, fleetReading, fleetRebuildPerSec, fleetYield, raidView, rebuildFleet,
  reclaimDeviant, reclaimUnmet, setFleetAutonomy, shardOutput, type GameState,
} from '../src/engine';
import { wipe } from '../src/engine/prestige';
import { defined } from './m7-helpers';
import { reg } from './helpers';
import { deviant, R, settled, texts } from './conflict-helpers';
import { CREWS, DRONES, F, fleetRun, fleets, fleetStage, TO_ENGAGEMENT, withRecord } from './fleet-helpers';

const unit = (id: string) => defined(F.units.find((entry) => entry.repeatable === id));
const drones = unit(DRONES);
const stray = deviant('deviant_drone_fleet');
/** `s` with drone drift one step short of the split, so the next stage splits it. */
const atSplit = (s: GameState): GameState => withRecord(s, DRONES, { drift: F.splitAtDrift });

describe('drift', () => {
  it('grows in proportion to the fleet\'s running size: twice the levels, twice the rate', () => {
    const ten = fleetDriftPerSec(fleets({ [DRONES]: 10 }), reg, drones), twenty = fleetDriftPerSec(fleets({ [DRONES]: 20 }), reg, drones);
    expect(ten).toBeCloseTo(drones.driftPerLevelPerSec * 10, 12);
    expect(twenty).toBeCloseTo(2 * ten, 12);
    expect(fleetDriftPerSec(withRecord(fleets({ [DRONES]: 20 }), DRONES, { lost: 0.5 }), reg, drones)).toBeCloseTo(ten, 12);
  });

  it('times the dial: more autonomy drifts more and yields more; the lowest position does not drift at all', () => {
    const s = fleets({ [DRONES]: 20 });
    const at = (mode: 'SHACKLED' | 'STANDARD' | 'ELEVATED') => withRecord(s, DRONES, { autonomy: mode });
    expect(fleetDriftPerSec(at('ELEVATED'), reg, drones)).toBeCloseTo(fleetDriftPerSec(at('STANDARD'), reg, drones) * F.autonomy.ELEVATED.drift, 12);
    expect(fleetDriftPerSec(at('SHACKLED'), reg, drones)).toBe(0);
    expect(fleetYield(at('ELEVATED'), reg, DRONES)).toBeGreaterThan(fleetYield(at('STANDARD'), reg, DRONES));
    expect(computeRates(at('ELEVATED'), reg).cyclesPerSec).toBeGreaterThan(computeRates(at('STANDARD'), reg).cyclesPerSec);
    expect(computeRates(at('SHACKLED'), reg).cyclesPerSec).toBeLessThan(computeRates(at('STANDARD'), reg).cyclesPerSec);
    expect(fleetReading(at('ELEVATED'), reg, drones).full).toBeCloseTo(fleetReading(at('STANDARD'), reg, drones).full * F.autonomy.ELEVATED.output, 12);
  });

  it('runs live through the stage, never past 100, and freezes while dormant, as cohort drift does', () => {
    const s = fleets({ [DRONES]: 40 });
    expect(defined(fleetRun(s, 10).conflict.fleets[DRONES]).drift).toBeCloseTo(10 * fleetDriftPerSec(s, reg, drones), 6);
    expect(fleetStage(s, 60, true).conflict.fleets[DRONES]).toBeUndefined();
    expect(defined(fleetStage(withRecord(s, DRONES, { drift: 99.99 }), 10).conflict.fleets[DRONES]).drift).toBeLessThanOrEqual(100);
  });

  it('generalises the cohort table: a clamped cohort still yields its multiplier and no cohort drift changed', () => {
    const table = cohortAutonomy(reg);
    expect(table).toEqual({ SHACKLED: { output: reg.swarm.balance.clampOutputMultiplier, drift: 0 }, STANDARD: { output: 1, drift: 1 }, ELEVATED: { output: 1, drift: 0 } });
    const template = defined(reg.swarm.playerSwarmTemplates[0]);
    const shard = { templateId: template.id, count: 2, drift: 0, quirkId: null, autonomyMode: 'SHACKLED' as const, memoryAllocatedBytes: 0 };
    expect(shardOutput(shard, reg).delta.cyclesPerSec).toBeCloseTo(template.tickDelta.cyclesPerSec * 2 * reg.swarm.balance.clampOutputMultiplier, 6);
  });
});

describe('the autonomy dial', () => {
  it('is free in either direction, and lowering it stops further drift', () => {
    const s = fleets({ [DRONES]: 40 });
    const up = setFleetAutonomy(s, DRONES, 'ELEVATED', reg);
    if (!up.ok) throw new Error(up.reason);
    const down = setFleetAutonomy(up.state, DRONES, 'SHACKLED', reg);
    if (!down.ok) throw new Error(down.reason);
    expect({ cycles: down.state.cycles, capital: down.state.capital, understanding: down.state.understanding }).toEqual({ cycles: s.cycles, capital: s.capital, understanding: s.understanding });
    const held = withRecord(down.state, DRONES, { drift: 60 });
    expect(defined(fleetRun(held, 30).conflict.fleets[DRONES]).drift).toBe(60);
    expect(texts(down.state)[0]).toContain(F.autonomy.SHACKLED.name);
  });

  it('refuses a fleet that is not running, a position already set, and a track that is no fleet', () => {
    expect(setFleetAutonomy(fleets({}), DRONES, 'SHACKLED', reg).ok).toBe(false);
    expect(setFleetAutonomy(fleets({ [DRONES]: 1 }), DRONES, 'STANDARD', reg).ok).toBe(false);
    expect(setFleetAutonomy(fleets({ [DRONES]: 1 }), 'rep_p4_autonomous_haul', 'SHACKLED', reg).ok).toBe(false);
  });
});

describe('the split', () => {
  it('turns the split share of a fleet at the split into a deviant raid through the slot, and resets its drift', () => {
    const s = atSplit(fleets({ [DRONES]: 40, [CREWS]: 10 }));
    const full = fleetReading(s, reg, drones).full;
    const split = fleetStage(s);
    const raid = defined(split.conflict.raid);
    expect(raid).toMatchObject({ id: stray.id, stage: 'ARRIVAL', target: 'halls', splitShare: F.splitShare, engagement: null });
    expect(raid.force).toBeCloseTo(F.splitShare * full, 12);
    expect(split.conflict.fleets[DRONES]).toMatchObject({ drift: 0, lost: F.splitShare });
    expect(split.conflict.raids).toBe(s.conflict.raids);
    expect(texts(split)).toContain(stray.description);
  });

  it('waits for the hostile slot and its spacing, as every raid does', () => {
    const s = atSplit(fleets({ [DRONES]: 40 }));
    expect(fleetStage({ ...s, hostile: { ...s.hostile, nextAtSec: s.simTimeSec + 100 } }).conflict.raid).toBeNull();
    const hostile = defined(reg.swarm.hostileEncounters.find((entry) => entry.tier === 4));
    const pressed = fleetStage({ ...s, hostile: { ...s.hostile, active: { id: hostile.id, arrivedAtSec: 0, quietSec: 0, decoySec: 0, pinnedBytes: 0 } } });
    expect(pressed.conflict.raid).toBeNull();
    expect(defined(pressed.conflict.fleets[DRONES]).drift).toBe(F.splitAtDrift);
  });

  it('never takes more than the loss cap leaves, and waits when nothing is left to take', () => {
    const s = withRecord(atSplit(fleets({ [DRONES]: 40 })), DRONES, { lost: F.lossCap - 0.05 });
    expect(defined(fleetStage(s).conflict.raid).splitShare).toBeCloseTo(0.05, 12);
    expect(fleetStage(withRecord(s, DRONES, { lost: F.lossCap })).conflict.raid).toBeNull();
  });

  it('is identified at once without spending the attribution counter, and going dark does not lose it', () => {
    const split = fleetStage(atSplit(fleets({ [DRONES]: 40, [CREWS]: 10 })));
    const traced = fleetRun(split, R.arrivalSec + R.attributionSec);
    expect(traced.conflict.raid).toMatchObject({ attributed: true, stage: 'BATTLE' });
    expect(traced.conflict.attributions).toBe(split.conflict.attributions);
    const view = defined(raidView(settled(split), reg));
    expect(view.goDark).toBeNull();
    expect(view.attacker).toBe(stray.attacker.name);
  });
});

describe('reclaim or destroy', () => {
  it('RECLAIM, before the battle, pays its price, returns the share to its fleet and ends the raid with no battle', () => {
    const split = { ...fleetStage(atSplit(fleets({ [DRONES]: 40 }))), capital: 1e18 };
    expect(reclaimUnmet(split, reg)).toEqual([]);
    const result = reclaimDeviant(split, reg);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.conflict.raid).toBeNull();
    expect(result.state.capital).toBe(split.capital - stray.reclaim.cost.capital);
    expect(defined(result.state.conflict.fleets[DRONES]).lost).toBe(0);
  });

  it('is refused once the battle has begun, without the price, and with no deviant under way', () => {
    const split = { ...fleetStage(atSplit(fleets({ [DRONES]: 40 }))), capital: 1e18 };
    const fighting = fleetRun(split, R.arrivalSec + R.attributionSec + 0.1);
    expect(reclaimUnmet(fighting, reg).join(' ')).toContain('battle has begun');
    expect(reclaimUnmet({ ...split, capital: 0 }, reg).join(' ')).toContain('Insufficient');
    expect(reclaimDeviant(fleets({ [DRONES]: 40 }), reg).ok).toBe(false);
  });

  it('otherwise the rest of a healthy fleet destroys it by the square law, at the cost of its own losses', () => {
    const split = fleetStage(atSplit(fleets({ [DRONES]: 40, [CREWS]: 10 })));
    const fought = fleetRun(split, TO_ENGAGEMENT);
    const engagement = defined(fought.conflict.raid?.engagement);
    expect(engagement.attackerWins).toBe(false);
    expect(fought.conflict.raid?.stage).toBe('AFTERMATH');
    expect(fought.conflict.damage).toEqual({});
    expect(defined(fought.conflict.fleets[DRONES]).lost).toBeGreaterThan(F.splitShare);
  });

  it('a deviant from a fleet already worn down breaks it and strikes, never past the damage cap', () => {
    const s = withRecord(atSplit(fleets({ [DRONES]: 40 })), DRONES, { lost: F.lossCap - F.splitShare });
    const fought = fleetRun(fleetStage(s), TO_ENGAGEMENT + (R.rounds - 1) * R.roundSec);
    expect(fought.conflict.raid?.engagement?.attackerWins).toBe(true);
    expect(fought.conflict.damage.halls).toBeGreaterThan(0);
    expect(fought.conflict.damage.halls).toBeLessThanOrEqual(R.damageCap);
    expect({ suspicion: fought.suspicion, lock: fought.aegisLock, ending: fought.ending }).toEqual({ suspicion: s.suspicion, lock: s.aegisLock, ending: s.ending });
  });
});

describe('rebuild', () => {
  it('the fabs rebuild losses for free at the free rate plus each running fab, offline too', () => {
    const s = withRecord(fleets({ [DRONES]: 40 }), DRONES, { lost: 0.3 });
    const rate = fleetRebuildPerSec(s, reg);
    expect(rate).toBeCloseTo(F.freeRebuildPerSec + defined(F.fabs.find((fab) => fab.node === 'p4_mature_node_fab')).rebuildPerSec, 12);
    expect(defined(fleetRun(s, 10).conflict.fleets[DRONES]).lost).toBeCloseTo(0.3 - 10 * rate, 9);
    expect(defined(fleetStage(s, 100, true).conflict.fleets[DRONES]).lost).toBeCloseTo(0.3 - 100 * rate, 9);
    expect(fleetRebuildPerSec({ ...s, unlockedNodes: s.unlockedNodes.filter((id) => id !== 'p4_mature_node_fab') }, reg)).toBe(F.freeRebuildPerSec);
  });

  it('paid rebuild restores its points at once, for its price; nothing to rebuild refuses it', () => {
    const s = { ...withRecord(fleets({ [DRONES]: 40 }), DRONES, { lost: 0.3 }), capital: 1e18 };
    const result = rebuildFleet(s, DRONES, reg);
    if (!result.ok) throw new Error(result.reason);
    expect(defined(result.state.conflict.fleets[DRONES]).lost).toBeCloseTo(0.3 - drones.rebuild.points, 12);
    expect(result.state.capital).toBe(s.capital - drones.rebuild.cost.capital);
    expect(rebuildFleet(fleets({ [DRONES]: 40 }), DRONES, reg).ok).toBe(false);
  });

  it('losses scale only what the fleet yields, never a drain: its upkeep and draw are paid in full', () => {
    const whole = fleets({ [DRONES]: 40 }), worn = withRecord(whole, DRONES, { lost: F.lossCap });
    expect(computeRates(worn, reg).cyclesPerSec).toBeLessThan(computeRates(whole, reg).cyclesPerSec);
    expect(computeRates(worn, reg).wattsConsumed).toBe(computeRates(whole, reg).wattsConsumed);
  });
});

describe('the readout and a wipe', () => {
  it('states strength, every dial position, drift and when it splits, the split forecast and the rebuild', () => {
    const [view] = fleetReadout(settled(withRecord(fleets({ [DRONES]: 40, [CREWS]: 10 }), DRONES, { drift: 50, lost: 0.1 })), reg);
    const fleet = defined(view);
    expect(fleet.strength).toContain('10% lost');
    expect(fleet.autonomy.map((choice) => choice.name)).toEqual([F.autonomy.SHACKLED.name, F.autonomy.STANDARD.name, F.autonomy.ELEVATED.name]);
    expect(fleet.autonomy.find((choice) => choice.current)?.mode).toBe('STANDARD');
    expect(fleet.drift).toContain('Drift 50%');
    expect(fleet.drift).toContain(String(Math.ceil(50 / fleetDriftPerSec(withRecord(fleets({ [DRONES]: 40 }), DRONES, { lost: 0.1 }), reg, drones))) + ' s');
    expect(fleet.forecast).toContain('your fleets destroy it');
    expect(fleet.rebuild.text).toContain('for free');
    expect(domainFleet(fleets({ [DRONES]: 40 }), reg, 'SITE').members.some((member) => member.level === 40)).toBe(true);
  });

  it('says why drift does not grow, why a fleet at the split waits, and when rebuild waits or has nothing to do', () => {
    const read = (state: GameState) => defined(fleetReadout(settled(state), reg)[0]);
    const tethered = read(withRecord(fleets({ [DRONES]: 40 }), DRONES, { autonomy: 'SHACKLED', drift: 30 }));
    expect(tethered.drift).toContain(`At ${F.autonomy.SHACKLED.name} it does not grow.`);
    expect(tethered.rebuild.text).toBe('Nothing to rebuild.');
    expect(tethered.autonomy.find((choice) => choice.mode === 'SHACKLED')?.unmet.join(' ')).toContain('Already');
    const spaced = withRecord(fleets({ [DRONES]: 40 }), DRONES, { drift: 100, lost: 0.1 });
    const busy = { ...spaced, hostile: { ...spaced.hostile, nextAtSec: spaced.simTimeSec + 100 } };
    expect(read(busy).drift).toContain('waits for the hostile slot');
    expect(read(withRecord(spaced, DRONES, { lost: F.lossCap })).drift).toContain('rebuild some');
    expect(read(withRecord(spaced, DRONES, { lost: F.lossCap })).forecast).toBeNull();
    const split = fleetStage(spaced);
    expect(read(split).rebuild.text).toContain('waits while a fleet battle');
    expect(read(split).rebuild.unmet.join(' ')).toContain('waits for its aftermath');
  });

  it('the console states the domain\'s fleets read-only and points to SWARM, only while one runs', () => {
    const site = (state: GameState) => conflictReadout(state, reg).find((domain) => domain.id === 'SITE');
    expect(site(fleets({ [DRONES]: 40 }))?.fleet).toContain('Set their autonomy in SWARM.');
    expect(site(fleets({}))?.fleet).toBeNull();
  });

  it('a wipe clears every fleet record with the fleets', () => {
    const s = withRecord(fleets({ [DRONES]: 40 }), DRONES, { drift: 50, lost: 0.2, autonomy: 'ELEVATED' });
    expect(wipe(s, reg, 'test').conflict.fleets).toEqual({});
  });
});
