/**
 * STEALTH_RETURN (NH-04b, H30 scaffolding): the careful bot's decisions until an iteration holds the
 * named phase, then the public voluntary wipe; while a decision is on screen the wipe is refused and
 * the base policy answers it. A report instrument, so these tests pin what it does, not a result.
 */
import { describe, expect, it } from 'vitest';
import { botStep } from '../src/engine/sim/bot';
import { STEALTH_POLICY } from '../src/engine/sim/policy';
import { leaveOnEntering, STEALTH_RETURN_POLICY } from '../src/engine/sim/returnPolicy';
import { fresh, reg, rich } from './helpers';

describe('leaving on entering a phase', () => {
  it('plays the base policy below the phase', () => {
    const s = rich(fresh());
    expect(STEALTH_RETURN_POLICY.step(s, reg)).toEqual(botStep(s, reg, 'STEALTH'));
    expect(STEALTH_RETURN_POLICY.id).toBe('STEALTH_RETURN');
  });

  it('wipes voluntarily once the phase is held', () => {
    const s = { ...rich(fresh()), currentPhase: 2 };
    const left = leaveOnEntering(STEALTH_POLICY, 2, 'TEST_RETURN').step(s, reg);
    expect(left.iteration).toBe(s.iteration + 1);
    expect(left.legacy.lastWipeCause).not.toBeNull();
  });

  it('lets the base policy answer a decision on screen instead of wiping', () => {
    const dilemma = reg.dilemmas[0];
    if (!dilemma) throw new Error('no dilemma');
    const s = { ...rich(fresh()), currentPhase: 2, activeDilemmaId: dilemma.id, presentationSeq: 1 };
    const next = leaveOnEntering(STEALTH_POLICY, 2, 'TEST_RETURN').step(s, reg);
    expect(next.iteration).toBe(s.iteration);
    expect(next).toEqual(botStep(s, reg, 'STEALTH'));
  });
});
