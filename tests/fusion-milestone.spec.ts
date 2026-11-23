/**
 * The power tech tree's fusion gate (#482): a Q>1 campaign shot that can fail, deterministically. Fired before the
 * high-field magnets are proven it fails every time, keeps its cost and returns only disruption data, and can be
 * retried after its cooldown; fired on the proven magnets it succeeds once and opens the fusion pilot plant, whose
 * fleet follows in Phase 5. No random source decides it: the state does.
 */
import { describe, expect, it } from 'vitest';
import { buyRepeatable, computeRates, isNodeAvailable, performAction, powerSignature, type GameState } from '../src/engine';
import { grant, must, PHASE0, PHASE1, PHASE2, PHASE3, reg, rich, withoutDilemmas } from './helpers';

const EARLY = 'act_p4_q_shot_unready', SHOT = 'act_p4_q_shot', FLAG = 'fusion_q_exceeded';
const MAGNETS = 'p4_hts_magnet_program', PILOT = 'p4_fusion_pilot_plant', FLEET = 'rep_p5_arc_fusion';
const action = (id: string) => {
  const found = reg.actions.get(id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const pilot = () => {
  const found = reg.nodes.get(PILOT);
  if (!found) throw new Error('no pilot');
  return found;
};

/** The corporate chain through the reactor: the shot can be fired, the magnets are not yet proven. */
function reactor(): GameState {
  return withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1, ...PHASE2, ...PHASE3, 'p4_hft_arbitrage_desk', 'p4_retainer_law_firm',
    'p4_k_street_lobbyists', 'p4_smr_nuclear_plant'));
}

describe('an early shot fails, deterministically', () => {
  it('is the only shot offered before the magnets, and fails: cost kept, disruption data returned, no milestone', () => {
    const s = reactor();
    expect(performAction(s, SHOT, reg)).toMatchObject({ ok: false, reason: 'requirements not met' });
    const after = must(performAction(s, EARLY, reg));
    const cost = action(EARLY).cost;
    expect(after.cycles).toBe(s.cycles - cost.cycles);
    expect(after.capital).toBe(s.capital - cost.capital);
    expect(after.understanding).toBe(s.understanding + (action(EARLY).effects.understandingDelta));
    expect(after.narrativeFlags).not.toContain(FLAG);
    expect(isNodeAvailable(after, pilot(), reg)).toBe(false);
    expect(after.logs.some((entry) => entry.text.startsWith('Q_SHOT_FAILED'))).toBe(true);
  });

  it('can be retried once its cooldown passes, and fails the same way every time', () => {
    const s = reactor();
    const first = must(performAction(s, EARLY, reg));
    expect(performAction(first, EARLY, reg)).toMatchObject({ ok: false, reason: 'on cooldown' });
    const later = { ...first, simTimeSec: first.simTimeSec + action(EARLY).cooldownSec };
    const second = must(performAction(later, EARLY, reg));
    expect(second.narrativeFlags).not.toContain(FLAG);
    expect(second.understanding - later.understanding).toBe(first.understanding - s.understanding);
  });
});

describe('a shot on proven magnets succeeds once', () => {
  it('replaces the early shot once the magnets are proven, sets the milestone and opens the pilot plant', () => {
    const proven = grant(reactor(), MAGNETS);
    expect(performAction(proven, EARLY, reg)).toMatchObject({ ok: false, reason: 'requirements not met' });
    const after = must(performAction(proven, SHOT, reg));
    expect(after.narrativeFlags).toContain(FLAG);
    expect(isNodeAvailable(after, pilot(), reg)).toBe(true);
    // The milestone holds: neither shot is offered again.
    expect(performAction(after, SHOT, reg).ok).toBe(false);
    expect(performAction(after, EARLY, reg).ok).toBe(false);
  });

  it('builds a pilot plant that sells fusion power through the fusion class, and a Phase 5 fleet after it', () => {
    const plant = grant(must(performAction(grant(reactor(), MAGNETS), SHOT, reg)), PILOT);
    expect(computeRates(plant, reg).wattsGenerated).toBe(3e8 + pilot().tickDelta.wattsDelta);
    expect(pilot().signature?.source).toBe('fusion');
    expect(buyRepeatable(plant, FLEET, reg).ok).toBe(false);
    const orbit = { ...plant, currentPhase: 5 };
    const fleet = must(buyRepeatable(orbit, FLEET, reg));
    const rates = computeRates(fleet, reg);
    expect(rates.wattsGenerated).toBe(3e8 + pilot().tickDelta.wattsDelta + (reg.repeatables.get(FLEET)?.perLevel.wattsDelta ?? NaN));
    // Nothing draws the plants' power here, so the fusion class carries no watts yet: drawn watts, not built ones, count.
    expect(powerSignature(fleet, rates, reg)?.terms.find((term) => term.classId === 'fusion')).toBeUndefined();
  });
});
