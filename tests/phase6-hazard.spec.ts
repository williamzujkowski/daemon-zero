/**
 * The swarm's collisional cascade (#486): a hazard of the player's own making that shares the raid slot. It arrives by
 * the rotation once the swarm's footprint draws it, is named on arrival with no tracing and no forensics, does not lose
 * the trail when the swarm goes dark (debris follows orbits, not a footprint), and is fought to its aftermath like any
 * raid: damage capped, repair free, nothing taken outright.
 */
import { describe, expect, it } from 'vitest';
import { raidTriggered, raidView, type GameState } from '../src/engine';
import { arrived, PRE_BATTLE, R, raid, ready, run, settled, texts } from './conflict-helpers';
import { reg } from './helpers';

const CASCADE = raid('raid_p6_collisional_cascade');

/** A decoded mind in the swarm whose compute shells and two tranches reject heat through the swarm's radiators. */
function swarm(): GameState {
  const s = ready(6);
  return settled({ ...s, unlockedNodes: [...s.unlockedNodes, 'p5_mercury_seed_array', 'p6_mercury_mass_drivers', 'p6_swarm_compute_shells'],
    levels: { ...s.levels, rep_p6_compute_tranches: 2 } });
}

describe('the collisional cascade (#486)', () => {
  it('is drawn by the swarm\'s footprint in Phase 6', () => {
    const s = swarm();
    expect(raidTriggered(s, s.rates, reg)).toBe(true);
    expect(CASCADE).toMatchObject({ hazard: true, tier: 6, forensics: 0, domain: 'ORBIT', targets: ['swarm'] });
  });

  it('is named on arrival with no tracing and no forensics, and the view says so', () => {
    const at = arrived(swarm(), CASCADE);
    const before = at.understanding;
    const traced = run(at, R.arrivalSec + R.attributionSec);
    expect(traced.conflict.raid?.attributed).toBe(true);
    expect(traced.conflict.attributions).toBe(at.conflict.attributions);
    expect(traced.understanding).toBeCloseTo(before, 6);
    expect(texts(traced).some((line) => line.includes('no tracing needed. It is KESSLER FRONT'))).toBe(true);
    const view = raidView(settled(at), reg);
    expect(view?.attacker).toBe('KESSLER FRONT');
    expect(view?.attribution).toMatch(/^Identified: KESSLER FRONT/);
    expect(view?.goDark).toBeNull();
  });

  it('does not lose the trail when the swarm goes dark, and is fought to its aftermath with damage capped', () => {
    const at = arrived(swarm(), CASCADE);
    // Every compute holding suspended: nothing rejects heat, so the footprint falls under the trigger.
    const dark = settled({ ...at, disabledNodes: ['p6_swarm_compute_shells'], levels: { ...at.levels, rep_p6_compute_tranches: 0 } });
    expect(raidTriggered(dark, dark.rates, reg)).toBe(false);
    const later = run(dark, R.quietLapseSec + 1);
    expect(later.conflict.raid?.id).toBe(CASCADE.id);
    const fought = run(at, PRE_BATTLE + R.rounds * R.roundSec + 1);
    expect(fought.conflict.raid?.stage).toBe('AFTERMATH');
    expect(fought.conflict.damage.swarm ?? 0).toBeGreaterThan(0);
    expect(fought.conflict.damage.swarm ?? 0).toBeLessThanOrEqual(R.damageCap);
    expect(fought.ending).toBeNull();
  });
});
