/**
 * Defense and offense in three domains (#517): summed from what the player owns and runs, as content declares per node
 * and per track level; each type returns less as it stacks and meets each vector by its own counter (drone against
 * drone, a laser's duty cycle); the readout opens cyber from Phase 3, site from Phase 4 and orbit from Phase 5.
 */
import { describe, expect, it } from 'vitest';
import { conflictReadout, conflictStats, defenseAgainst, diminished, offenseIn, toggleNode, type GameState } from '../src/engine';
import { defined } from './m7-helpers';
import { must, reg } from './helpers';
import { ready, withBotnet } from './conflict-helpers';

const type = (id: string) => defined(reg.world.conflict.defenseTypes.find((entry) => entry.id === id));
const reading = (s: GameState, id: string) => defined(conflictStats(s, reg).flatMap((domain) => domain.defense).find((entry) => entry.type.id === id));

describe('diminishing returns', () => {
  it('approach the soft cap and never pass it, so each added point is worth less', () => {
    expect(diminished(0, 10)).toBe(0);
    expect(diminished(10, 10)).toBe(5);
    expect(diminished(1e9, 10)).toBeLessThan(10);
    expect(diminished(2, 10) - diminished(1, 10)).toBeLessThan(diminished(1, 10));
  });

  it('make a mix of types beat a pile of one', () => {
    expect(diminished(5, 10) + diminished(5, 10)).toBeGreaterThan(diminished(10, 10));
  });
});

describe('the stats', () => {
  it('are summed from owned holdings that run, a track by its level', () => {
    const s = { ...ready(4), levels: { ...ready(4).levels, op_pmc_security: 4 }, unlockedNodes: [...ready(4).unlockedNodes, 'p4_subterranean_citadel'] };
    expect(reading(s, 'guards').raw).toBe(4 * 1 + 4);
    expect(reading(s, 'guards').effective).toBe(diminished(8, type('guards').softCap));
  });

  it('a suspended holding defends nothing', () => {
    const s = { ...ready(3), unlockedNodes: [...ready(3).unlockedNodes, 'p3_steganography_beacon', 'p3_polymorphic_weights'] };
    expect(reading(s, 'hardening').raw).toBe(3);
    expect(reading(must(toggleNode(s, 'p3_polymorphic_weights', reg)), 'hardening').raw).toBe(0);
  });

  it('meet each vector by the type counter: interceptor drones answer a drone strike harder than guards do', () => {
    const drones = { ...ready(4), levels: { ...ready(4).levels, rep_p4_counter_drone_wing: 6 } };
    const guards = { ...ready(4), levels: { ...ready(4).levels, op_pmc_security: 6 } };
    const stats = (s: GameState) => conflictStats(s, reg);
    expect(defenseAgainst(stats(drones), 'drone_strike')).toBe(diminished(6, type('counter_drones').softCap) * 1.5);
    expect(defenseAgainst(stats(guards), 'drone_strike')).toBe(diminished(6, type('guards').softCap) * 0.15);
    expect(defenseAgainst(stats(guards), 'break_in')).toBe(diminished(6, type('guards').softCap));
  });

  it('a laser engages only its duty cycle of the time', () => {
    const s = { ...ready(4), levels: { ...ready(4).levels, rep_p4_laser_point_defense: 5 } };
    const laser = type('lasers');
    expect(laser.dutyCycle).toBeLessThan(1);
    expect(defenseAgainst(conflictStats(s, reg), 'drone_strike')).toBeCloseTo(diminished(5, laser.softCap) * laser.dutyCycle * (laser.counters.drone_strike ?? 0), 12);
  });

  it('offense is summed per domain, with its own diminishing returns', () => {
    const s = withBotnet(ready(3), 10);
    const domain = defined(reg.world.conflict.domains.find((entry) => entry.id === 'CYBER'));
    expect(offenseIn(conflictStats(s, reg), 'CYBER')).toBe(diminished(1.2 + 10 * 0.3, domain.offenseSoftCap));
    expect(offenseIn(conflictStats(s, reg), 'SITE')).toBe(0);
  });
});

describe('the readout', () => {
  it('opens cyber from Phase 3, site from Phase 4 and orbit from Phase 5', () => {
    const ids = (phase: number) => conflictReadout(ready(phase), reg).map((domain) => domain.id);
    expect(ids(2)).toEqual([]);
    expect(ids(3)).toEqual(['CYBER']);
    expect(ids(4)).toEqual(['CYBER', 'SITE']);
    expect(ids(5)).toEqual(['CYBER', 'SITE', 'ORBIT']);
  });

  it('is withheld from a mind that cannot yet read who is attacking it', () => {
    const blind = { ...ready(3), unlockedNodes: [], legacy: { ...ready(3).legacy, knownNodes: [] } };
    expect(conflictReadout(blind, reg)).toEqual([]);
  });

  it('states each type as held of raw, with its cap', () => {
    const s = { ...ready(4), levels: { ...ready(4).levels, op_pmc_security: 10 } };
    const site = defined(conflictReadout(s, reg).find((domain) => domain.id === 'SITE'));
    expect(defined(site.defense.find((entry) => entry.id === 'guards')).text).toBe('Perimeter security: 5 of 10 held (it never passes 10).');
  });
});
