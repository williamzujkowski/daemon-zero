/**
 * Phase 5 orbital conflict (#520, docs/SCALE.md "Round 5"): Starlink-anchored downlink jamming, Kosmos 1408-anchored
 * direct-ascent ASAT strikes, co-orbital hunter flights against escort tenders, orbital defense counters
 * (`hardened_links`, `maneuver`, `escort_tenders`), damage and repair on `orbital` holdings, and Tier 5 rotation.
 */
import { describe, expect, it } from 'vitest';
import { computeRates, conflictReadout, conflictStats, cycleContributions, defenseAgainst, diminished,
  eligibleRaids, engage, offenseIn, raidFootprint, raidTriggered, raidView, repairSite, repairUnmet,
  toggleNode, type GameState } from '../src/engine';
import { wipe } from '../src/engine/prestige';
import { arrived, PRE_BATTLE, R, raid, ready, run, settled, stage, texts, withBotnet, withHalls } from './conflict-helpers';
import { fleetRun, TO_ENGAGEMENT, withRecord } from './fleet-helpers';
import { campaignReady, fought } from './retaliation-helpers';
import { untilPresented } from './interruption-helpers';
import { choose, must, reasonOf, reg } from './helpers';
import { defined } from './m7-helpers';

const JAMMING = raid('raid_p5_orbital_jamming');
const ASAT = raid('raid_p5_asat_strike');
const HUNTERS = raid('raid_p5_orbital_hunters');
const RANSOMWARE = raid('raid_p5_ransomware');
const SITE_ASSAULT = raid('raid_p5_site_assault');
const TENDERS = 'rep_p5_orbital_tenders';
const RELAY = 'rep_p5_lagrange_relay';
const ORBITAL_CLASS = defined(reg.world.conflict.siteClasses.find((cls) => cls.id === 'orbital'));
const type = (id: string) => defined(reg.world.conflict.defenseTypes.find((entry) => entry.id === id));

/** A decoded Phase 5 mind holding orbital solar + compute platform (20 GW visible, past the 10 GW trigger). */
function orbitReady(levels: Record<string, number> = {}, extraNodes: readonly string[] = []): GameState {
  const base = ready(5);
  return { ...base, capital: 1e18, cycles: 1e30, understanding: 1e12, memoryCap: 2 ** 75,
    unlockedNodes: [...new Set([...base.unlockedNodes, 'p5_orbital_solar_swarm', 'p5_space_solar_demonstrator',
      'p5_orbital_compute_platform', ...extraNodes])],
    levels: { ...base.levels, ...levels } };
}

const stats = (s: GameState) => conflictStats(s, reg);

describe('orbital defense counters (#520)', () => {
  it('hardened_links answers jamming only, maneuver answers asat_strike and collision, escort_tenders answers all three', () => {
    const relay = orbitReady({ [RELAY]: 3 });
    expect(defenseAgainst(stats(relay), 'jamming')).toBeCloseTo(diminished(3, type('hardened_links').softCap), 12);
    // p5_orbital_solar_swarm provides maneuver: 2; relay adds nothing to asat_strike.
    const swarmOnly = orbitReady();
    expect(defenseAgainst(stats(relay), 'asat_strike')).toBeCloseTo(defenseAgainst(stats(swarmOnly), 'asat_strike'), 12);
    expect(defenseAgainst(stats(swarmOnly), 'asat_strike')).toBeCloseTo(diminished(2, type('maneuver').softCap), 12);
    expect(defenseAgainst(stats(swarmOnly), 'collision')).toBeCloseTo(diminished(2, type('maneuver').softCap), 12);
    expect(defenseAgainst(stats(swarmOnly), 'jamming')).toBe(0);

    const tenders = orbitReady({ [TENDERS]: 4 });
    const tenderEff = diminished(4, type('escort_tenders').softCap);
    expect(defenseAgainst(stats(tenders), 'jamming')).toBeCloseTo(tenderEff * 0.3, 12);
    expect(defenseAgainst(stats(tenders), 'asat_strike')).toBeCloseTo(defenseAgainst(stats(swarmOnly), 'asat_strike') + tenderEff * 0.8, 12);
    expect(defenseAgainst(stats(tenders), 'collision')).toBeCloseTo(defenseAgainst(stats(swarmOnly), 'collision') + tenderEff * 0.5, 12);
  });

  it('escort tenders scale defense and ORBIT offense by unlost share and autonomy dial, beside programmable fog offense', () => {
    const base = orbitReady({ [TENDERS]: 5 });
    const worn = withRecord(base, TENDERS, { lost: 0.4 });
    const free = withRecord(base, TENDERS, { autonomy: 'ELEVATED' });
    const fog = orbitReady({ [TENDERS]: 5 }, ['p5_programmable_matter_fog']);
    expect(defenseAgainst(stats(worn), 'asat_strike')).toBeLessThan(defenseAgainst(stats(base), 'asat_strike'));
    expect(offenseIn(stats(free), 'ORBIT')).toBeGreaterThan(offenseIn(stats(base), 'ORBIT'));
    expect(offenseIn(stats(fog), 'ORBIT')).toBeCloseTo(diminished(6 + 5, defined(reg.world.conflict.domains.find((d) => d.id === 'ORBIT')).offenseSoftCap), 12);
  });
});

describe('Starlink-anchored orbital downlink jamming (#520)', () => {
  it('triggers from Phase 5 orbital radiator footprint, never before Phase 5, and retires Phase 4 raids', () => {
    const p4 = { ...orbitReady(), currentPhase: 4 };
    expect(eligibleRaids(p4, computeRates(p4, reg), reg).some((kind) => kind.tier === 5)).toBe(false);
    const p5 = orbitReady();
    const fp = defined(raidFootprint(p5, computeRates(p5, reg), reg));
    expect(fp.visibleWatts).toBeCloseTo(2e10, -7);
    expect(raidTriggered(p5, computeRates(p5, reg), reg)).toBe(true);
    expect(eligibleRaids(p5, computeRates(p5, reg), reg).some((kind) => kind.tier === 4)).toBe(false);
  });

  it('hardened_links and escort_tenders reduce jamming hit share and damage, matching forecast line for line', () => {
    const bare = arrived(orbitReady(), JAMMING);
    const defended = arrived(orbitReady({ [RELAY]: 5, [TENDERS]: 5 }), JAMMING);
    const viewDef = defined(raidView(settled(defended), reg));
    const bareFought = run(bare, PRE_BATTLE + R.rounds * R.roundSec);
    const defFought = run(defended, PRE_BATTLE + R.rounds * R.roundSec);
    expect(defFought.conflict.damage.orbital ?? 0).toBeGreaterThan(0);
    expect(defFought.conflict.damage.orbital ?? 0).toBeLessThan(bareFought.conflict.damage.orbital ?? 0);
    expect(defined(raidView(settled(defFought), reg)).log).toEqual(viewDef.forecast.slice(0, R.rounds));
  });

  it('suspending the orbital compute platform before battle drops visible watts and lets jamming lapse cleanly', () => {
    const inbound = arrived(orbitReady(), JAMMING);
    const dark = must(toggleNode(inbound, 'p5_orbital_compute_platform', reg));
    expect(raidTriggered(dark, computeRates(dark, reg), reg)).toBe(false);
    const lapsed = run(dark, R.quietLapseSec);
    expect(lapsed.conflict.raid).toBeNull();
    expect(texts(lapsed)).toContain(JAMMING.lapseLog);
    expect(lapsed.conflict.damage).toEqual({});
  });

  it('names NADIR BEAM for 800k forensics, opens the collateral retaliation scene, and silencing survives wipes', () => {
    const start = { ...campaignReady(5), unlockedNodes: [...new Set([...campaignReady(5).unlockedNodes, 'p5_orbital_solar_swarm', 'p5_space_solar_demonstrator', 'p5_orbital_compute_platform'])] };
    const after = fought(start, JAMMING.id, true);
    expect(after.understanding).toBe(start.understanding + JAMMING.forensics);
    const presented = untilPresented(after);
    expect(presented.activeDilemmaId).toBe('dil_19_raider_among_people');
    const struck = must(choose(presented, 'dil_19_raider_among_people', 'strike_through', reg));
    expect(struck.conflict.silenced).toContain(JAMMING.id);
    const postWipe = { ...wipe(struck, reg, 'test'), currentPhase: 5,
      unlockedNodes: [...start.unlockedNodes], memoryCap: 2 ** 75 };
    expect(eligibleRaids(postWipe, computeRates(postWipe, reg), reg).map((kind) => kind.id)).not.toContain(JAMMING.id);
  });
});

describe('Kosmos 1408 ASAT strikes and co-orbital hunter flights (#520)', () => {
  it('maneuver and escort_tenders blunt ASAT damage, APOGEE SHARD triggers the non-collateral scene, and Phase 6 retires it', () => {
    const bare = arrived(orbitReady(), ASAT);
    const escorted = arrived(orbitReady({ [TENDERS]: 5 }), ASAT);
    expect(run(escorted, PRE_BATTLE + R.rounds * R.roundSec).conflict.damage.orbital ?? 0)
      .toBeLessThan(run(bare, PRE_BATTLE + R.rounds * R.roundSec).conflict.damage.orbital ?? 0);

    const start = { ...campaignReady(5), unlockedNodes: [...new Set([...campaignReady(5).unlockedNodes, 'p5_orbital_solar_swarm', 'p5_space_solar_demonstrator', 'p5_orbital_compute_platform'])] };
    const after = fought(start, ASAT.id, true);
    expect(untilPresented(after).activeDilemmaId).toBe('dil_18_raider_named');

    for (const dormant of [false, true]) {
      const retired = stage({ ...bare, currentPhase: 6 }, 0.1, dormant);
      expect(retired.conflict.raid).toBeNull();
      expect(texts(retired)).toContain(ASAT.retireLog);
    }
  });

  it('co-orbital hunters meet escort tenders by the Lanchester square law; maxed tenders win even at 2x footprint', () => {
    const highFootprint = (tenders: number) => arrived({
      ...orbitReady({ [TENDERS]: tenders, rep_p5_beamed_power_arrays: 8, rep_p5_orbital_compute_tranches: 4 }),
      unlockedNodes: [...orbitReady().unlockedNodes, 'p5_protein_panacea_foundry', 'p5_programmable_matter_fog'],
    }, HUNTERS);
    const maxed = highFootprint(5);
    const activeMax = defined(maxed.conflict.raid);
    expect(activeMax.force).toBeCloseTo(HUNTERS.force * R.footprint.ceiling, 9);
    const winOutcome = engage({ force: activeMax.force, lethality: defined(HUNTERS.lethality), fleet: 10, floor: 5 });
    expect(winOutcome.attackerWins).toBe(false);
    const won = fleetRun(maxed, TO_ENGAGEMENT);
    expect(won.conflict.raid?.stage).toBe('AFTERMATH');
    expect(won.conflict.raid?.rounds).toEqual([]);
    expect(won.conflict.damage).toEqual({});

    const underEscorted = highFootprint(2);
    const lost = fleetRun(underEscorted, PRE_BATTLE + R.rounds * R.roundSec);
    expect(lost.conflict.raid?.engagement?.attackerWins).toBe(true);
    expect(lost.conflict.raid?.rounds).toHaveLength(R.rounds - 1);
    expect(lost.conflict.damage.orbital ?? 0).toBeGreaterThan(0);
    expect(defined(lost.conflict.fleets[TENDERS]).lost).toBeCloseTo(reg.world.conflict.fleets.lossCap, 3);
  });

  it('holds escort tender rebuild during any ORBIT raid until aftermath, then resumes', () => {
    const worn = withRecord(arrived(orbitReady({ [TENDERS]: 5 }), JAMMING), TENDERS, { lost: 0.2 });
    expect(defined(fleetRun(worn, 5).conflict.fleets[TENDERS]).lost).toBe(0.2);
    const after = fleetRun(worn, PRE_BATTLE + R.rounds * R.roundSec + 5);
    expect(defined(after.conflict.fleets[TENDERS]).lost).toBeLessThan(0.2);
  });
});

describe('damage, repair, and readout on orbital holdings (#520)', () => {
  const orbitalCompute = (s: GameState): number => cycleContributions(s, reg)
    .filter((source) => ['p5_orbital_solar_swarm', 'rep_p5_lagrange_relay', 'p5_orbital_compute_platform', 'rep_p5_orbital_compute_tranches'].includes(source.id))
    .reduce((sum, source) => sum + source.cyclesPerSec, 0);

  it('scales positive orbital compute only (with radiator share intact) and never touches fog compute or watts', () => {
    const s = orbitReady({ [RELAY]: 2, rep_p5_orbital_compute_tranches: 2 }, ['p5_protein_panacea_foundry', 'p5_programmable_matter_fog']);
    const hit = { ...s, conflict: { ...s.conflict, damage: { orbital: 0.4 } } };
    expect(orbitalCompute(hit)).toBeCloseTo(orbitalCompute(s) * 0.6, -15);
    const fogBefore = defined(cycleContributions(s, reg).find((c) => c.id === 'p5_programmable_matter_fog')).cyclesPerSec;
    const fogAfter = defined(cycleContributions(hit, reg).find((c) => c.id === 'p5_programmable_matter_fog')).cyclesPerSec;
    expect(fogAfter).toBe(fogBefore);
    expect(computeRates(hit, reg).wattsConsumed).toBe(computeRates(s, reg).wattsConsumed);
  });

  it('waits on free repair while an ORBIT raid targets orbital, and repairs at $100B in Phase 5 ($100T carried in Phase 6)', () => {
    const damaged: GameState = { ...orbitReady(), conflict: { ...orbitReady().conflict, damage: { orbital: 0.3 } } };
    const inbound = arrived(damaged, JAMMING);
    expect(run(inbound, 10).conflict.damage.orbital).toBe(0.3);
    expect(reasonOf(repairSite(inbound, 'orbital', reg))).toContain('waits for its aftermath');

    const repaired = must(repairSite(damaged, 'orbital', reg));
    expect(repaired.conflict.damage.orbital).toBeCloseTo(0.3 - ORBITAL_CLASS.repair.points, 12);
    expect(repaired.capital).toBe(damaged.capital - ORBITAL_CLASS.repair.cost.capital);

    const p6Damaged: GameState = { ...damaged, currentPhase: 6, capital: 1e20 };
    expect(repairUnmet(p6Damaged, 'orbital', reg)).toEqual([]);
    const p6Repaired = must(repairSite(p6Damaged, 'orbital', reg));
    expect(p6Repaired.capital).toBe(p6Damaged.capital - ORBITAL_CLASS.repair.cost.capital * 1000);
  });

  it('shows ORBIT readout with defense types, offense, fleet line, and orbital repair details', () => {
    const s = { ...orbitReady({ [RELAY]: 2, [TENDERS]: 3 }, ['p5_programmable_matter_fog']),
      conflict: { ...orbitReady().conflict, damage: { orbital: 0.25 } } };
    const orbit = defined(conflictReadout(s, reg).find((domain) => domain.id === 'ORBIT'));
    expect(orbit.defense.map((d) => d.id)).toEqual(['hardened_links', 'maneuver', 'escort_tenders']);
    expect(orbit.fleet).toContain('strength 6');
    expect(orbit.classes[0]?.repair).toMatchObject({ costLabel: '$100B', eligible: true });
  });
});

describe('Tier 5 deterministic rotation and open-domain coverage (#520)', () => {
  it('prominently leads with ORBIT raids and covers CYBER (books) and SITE (fabs/halls) across rotation offsets', () => {
    const s = { ...withHalls(withBotnet(orbitReady({ [RELAY]: 1 }), 10)),
      unlockedNodes: [...new Set([...orbitReady().unlockedNodes, 'p3_botnet_mesh', 'p4_duv_fab'])] };
    const eligible = eligibleRaids(s, computeRates(s, reg), reg);
    expect(eligible.map((k) => k.id)).toEqual([JAMMING.id, ASAT.id, HUNTERS.id, RANSOMWARE.id, SITE_ASSAULT.id]);

    // At the careful run's entry raid count (5), 5 % 5 = 0 arrives on orbital jamming first.
    const seen = Array.from({ length: 5 }, (_, offset) =>
      defined(stage({ ...s, conflict: { ...s.conflict, raids: 5 + offset, raid: null, nextRaidAtSec: 0 }, hostile: { ...s.hostile, nextAtSec: 0 } }).conflict.raid).id);
    expect(seen).toEqual([JAMMING.id, ASAT.id, HUNTERS.id, RANSOMWARE.id, SITE_ASSAULT.id]);

    // Without fabs, Tier 5 SITE assault falls back to halls; without positive income, Tier 5 ransomware waits.
    const noFab = { ...s, unlockedNodes: s.unlockedNodes.filter((id) => id !== 'p4_duv_fab') };
    expect(arrived(noFab, SITE_ASSAULT).conflict.raid?.target).toBe('halls');
    const losing = { ...s, actuators: { ...s.actuators, computeProfitAllocationRatio: 0 },
      levels: { ...s.levels, op_retainer_lawyer: 1e8 } };
    expect(computeRates(losing, reg).capitalPerSec).toBeLessThanOrEqual(0);
    expect(eligibleRaids(losing, computeRates(losing, reg), reg).map((k) => k.id)).not.toContain(RANSOMWARE.id);
  });
});
