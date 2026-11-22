/**
 * EVALUATING_RETURN (#262) and the bot overrides it uses: without overrides STEALTH plays exactly as
 * before; the evaluating returns keep noisy income and scrub from 45 with at most a quarter of the
 * bank; iteration 1 is STEALTH_RETURN. The observer counts what the policy did without changing it.
 * A report instrument, so these tests pin what it does, not a result.
 */
import { describe, expect, it } from 'vitest';
import { meetsRequirements, performAction } from '../src/engine';
import type { GameState } from '../src/engine';
import { botStep } from '../src/engine/sim/bot';
import { EVALUATING_OVERRIDES, EVALUATING_RETURN_POLICY } from '../src/engine/sim/evaluatingPolicy';
import type { SimPolicy } from '../src/engine/sim/policy';
import { formatWatch, observeReturns } from '../src/engine/sim/returnObserver';
import { STEALTH_RETURN_POLICY } from '../src/engine/sim/returnPolicy';
import { fresh, grant, must, PHASE0, PHASE1, reg, rich, withoutDilemmas } from './helpers';

const SCRUB = 'act_p2_scrub_audit_logs';
/** Suspicion-reducing actions performed: the scrub, or a pricier answer the fixed alarm prefers. */
const scrubs = (s: GameState): number => [...reg.actions.values()]
  .filter((action) => action.effects.suspicionDelta < 0)
  .reduce((sum, action) => sum + (s.actionCounts[action.id] ?? 0), 0);
const noisyLevels = (s: GameState): number => [...reg.repeatables.values()]
  .filter((rep) => rep.perLevel.suspicionPerSec > 0)
  .reduce((sum, rep) => sum + (s.levels[rep.id] ?? 0), 0);

/**
 * Banks are stated against the scrub's price, read from content (#461 re-priced it from 1,500 cycles to FLOP): plenty is
 * a thousand scrubs, as 1e6 once was about 670; "short" is what the old 5,000 bought, about three scrubs.
 */
const SCRUB_PRICE = reg.actions.get(SCRUB)?.cost.cycles ?? 0;
const PLENTY = 1000 * SCRUB_PRICE;
const SHORT = (10 / 3) * SCRUB_PRICE;

/** A returning instance on the network, with ARP discovery mapped and no story on the way. */
function onNetwork(suspicion: number, cycles: number, iteration = 2): GameState {
  const s = withoutDilemmas(grant(rich(fresh()), ...PHASE0, ...PHASE1, 'p2_arp_discovery'));
  return { ...s, iteration, suspicion, cycles };
}

describe('bot overrides', () => {
  it('leave STEALTH and GREEDY unchanged when absent or empty', () => {
    for (const s of [rich(fresh()), onNetwork(30, PLENTY), onNetwork(50, SHORT)]) {
      expect(botStep(s, reg, 'STEALTH', {})).toEqual(botStep(s, reg, 'STEALTH'));
      expect(botStep(s, reg, 'GREEDY', {})).toEqual(botStep(s, reg, 'GREEDY'));
    }
  });

  it('move the scrub alarm: STEALTH scrubs at 30, the evaluating player waits for 45', () => {
    const s = onNetwork(30, PLENTY);
    expect(scrubs(botStep(s, reg, 'STEALTH'))).toBe(1);
    expect(scrubs(botStep(s, reg, 'STEALTH', EVALUATING_OVERRIDES))).toBe(0);
    expect(scrubs(botStep({ ...s, suspicion: 45 }, reg, 'STEALTH', EVALUATING_OVERRIDES))).toBe(1);
  });

  it('scrub only with an action costing at most a quarter of the bank', () => {
    // The cheapest answer this state can press sets the threshold. Since the rescale (#461) that is the ticket edit,
    // three thousand times cheaper than the log scrub, where it used to cost more than the scrub; the rule is the same.
    const answers = [...reg.actions.values()].filter((action) => action.effects.suspicionDelta < 0 && meetsRequirements(onNetwork(50, PLENTY), action.requirements, reg));
    const price = Math.min(...answers.map((action) => action.cost.cycles));
    expect(price).toBeGreaterThan(0);
    // The largest bank below four answers: past 2^53 FLOP, "4 x price - 1" is four answers exactly.
    const short = price * 4 * (1 - Number.EPSILON);
    expect(short).toBeLessThan(price * 4);
    expect(scrubs(botStep(onNetwork(50, short), reg, 'STEALTH', EVALUATING_OVERRIDES))).toBe(0);
    expect(scrubs(botStep(onNetwork(50, price * 4), reg, 'STEALTH', EVALUATING_OVERRIDES))).toBe(1);
    // The fixed alarm spends whatever it has.
    expect(scrubs(botStep(onNetwork(50, short), reg, 'STEALTH'))).toBe(1);
  });

  it('keep noisy income past the alarm, which STEALTH refuses', () => {
    // Too little for the spoofer or a quarter-bank scrub, so the next purchase is income.
    const spoofer = reg.nodes.get('p2_log_spoofer')?.cost.cycles ?? 0;
    const s = onNetwork(60, Math.min(spoofer, 4 * SCRUB_PRICE) / 2);
    expect(noisyLevels(botStep(s, reg, 'STEALTH'))).toBe(noisyLevels(s));
    expect(noisyLevels(botStep(s, reg, 'STEALTH', EVALUATING_OVERRIDES))).toBeGreaterThan(noisyLevels(s));
  });
});

describe('EVALUATING_RETURN', () => {
  it('plays STEALTH_RETURN in iteration 1', () => {
    const s = onNetwork(30, PLENTY, 1);
    expect(EVALUATING_RETURN_POLICY.step(s, reg)).toEqual(STEALTH_RETURN_POLICY.step(s, reg));
    expect(EVALUATING_RETURN_POLICY.id).toBe('EVALUATING_RETURN');
  });

  it('plays the evaluating knobs in a return, and leaves on entering phase 5', () => {
    const s = onNetwork(30, PLENTY);
    expect(EVALUATING_RETURN_POLICY.step(s, reg)).toEqual(botStep(s, reg, 'STEALTH', EVALUATING_OVERRIDES));
    const left = EVALUATING_RETURN_POLICY.step({ ...s, currentPhase: 5 }, reg);
    expect(left.iteration).toBe(3);
  });
});

describe('return observer', () => {
  const scrubber: SimPolicy = { id: 'SCRUBBER', summary: 'scrubs when it can', step: (s, r) => {
    const result = performAction(s, SCRUB, r);
    return result.ok ? result.state : s;
  } };

  it('records peak suspicion and suspicion-reducing actions per iteration without changing a decision', () => {
    const watched = observeReturns(scrubber);
    const s = onNetwork(40, PLENTY);
    const next = watched.policy.step(s, reg);
    expect(next).toEqual(scrubber.step(s, reg));
    expect(watched.policy.id).toBe('SCRUBBER');
    watched.policy.step({ ...next, suspicion: 70 }, reg);
    expect(watched.byIteration.get(2)).toEqual({ peakSuspicion: 70, suspicionActions: 1 });
    expect(formatWatch(watched.byIteration, [1, 2])).toBe('  peak suspicion / suspicion actions: #1 - | #2 70.0 / 1');
  });

  it('counts nothing across a wipe, where action counts reset', () => {
    const before = must(performAction(onNetwork(40, PLENTY), SCRUB, reg));
    const wiping: SimPolicy = { id: 'WIPER', summary: 'a decision in the next iteration', step: (s) => ({ ...s, iteration: s.iteration + 1, actionCounts: {} }) };
    const watched = observeReturns(wiping);
    watched.policy.step(before, reg);
    expect(watched.byIteration.get(3)?.suspicionActions).toBe(0);
  });
});
