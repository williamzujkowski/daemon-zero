import { describe, expect, it } from 'vitest';
import { CONTENT as PREVIEW } from '../src/content/preview';
import { GameStateSchema, type GameState } from '../src/engine';
import { botStep } from '../src/engine/sim/bot';
import { runHeadlessSim, runPolicySim } from '../src/engine/sim/headlessSim';
import { IDLE_POLICY } from '../src/engine/sim/idlePolicy';
import { SIM_POLICIES } from '../src/engine/sim/policies';
import {
  createPolicyCatalog, GREEDY_POLICY, resolvePolicy, STEALTH_POLICY, strategyPolicy, type SimPolicy,
} from '../src/engine/sim/policy';
import type { DilemmaChoice } from '../src/content';
import { fresh, reg, rich } from './helpers';

const SHORT_SEC = 1800;
// Full replays under coverage on a shared CI runner; simulated-time limits are separate.
const SLOW_MS = 30_000;

describe('sim policy catalog', () => {
  it('lists the bot strategies, the reference plug-in, the truthful route policies and the return policies', () => {
    expect([...SIM_POLICIES.keys()]).toEqual(['STEALTH', 'GREEDY', 'IDLE', 'TRUTHFUL_THOROUGH', 'TRUTHFUL_LOW_RESOURCE', 'STEALTH_RETURN', 'RETURNING_LOW_RESOURCE',
      'PILOT_SERVICE_FIRST', 'PILOT_STUDY_FIRST']);
    expect(resolvePolicy(SIM_POLICIES, 'STEALTH')).toBe(STEALTH_POLICY);
    expect(resolvePolicy(SIM_POLICIES, 'IDLE')).toBe(IDLE_POLICY);
  });

  it('rejects an unknown strategy and names the known ones', () => {
    expect(() => resolvePolicy(SIM_POLICIES, 'HONEST')).toThrow('unknown sim policy "HONEST" (known: STEALTH, GREEDY, IDLE, TRUTHFUL_THOROUGH, TRUTHFUL_LOW_RESOURCE, STEALTH_RETURN, RETURNING_LOW_RESOURCE, PILOT_SERVICE_FIRST, PILOT_STUDY_FIRST)');
    expect(() => resolvePolicy(SIM_POLICIES, 'stealth')).toThrow('unknown sim policy');
  });

  it('refuses a repeated or malformed id', () => {
    const copy: SimPolicy = { ...IDLE_POLICY };
    expect(() => createPolicyCatalog([IDLE_POLICY, copy])).toThrow('sim policy "IDLE" is defined twice');
    expect(() => createPolicyCatalog([{ ...IDLE_POLICY, id: 'low-resource' }])).toThrow('must be upper snake case');
    expect(() => createPolicyCatalog([{ ...IDLE_POLICY, id: '' }])).toThrow('must be upper snake case');
  });
});

describe('bot strategies as policies', () => {
  it('step exactly as botStep does', () => {
    let s = fresh();
    for (let i = 0; i < 30; i++) {
      expect(STEALTH_POLICY.step(s, reg)).toEqual(botStep(s, reg, 'STEALTH'));
      expect(GREEDY_POLICY.step(s, reg)).toEqual(botStep(s, reg, 'GREEDY'));
      s = botStep(s, reg, 'STEALTH');
    }
    expect(strategyPolicy('GREEDY').id).toBe('GREEDY');
  });

  it('produce the same report through runPolicySim as through runHeadlessSim', () => {
    expect(runPolicySim(reg, STEALTH_POLICY, { maxSimSec: SHORT_SEC })).toEqual(runHeadlessSim(reg, { strategy: 'STEALTH', maxSimSec: SHORT_SEC }));
    expect(runPolicySim(reg, GREEDY_POLICY, { maxSimSec: SHORT_SEC })).toEqual(runHeadlessSim(reg, { strategy: 'GREEDY', maxSimSec: SHORT_SEC }));
  }, SLOW_MS);
});

describe('a new policy plugs in without touching the bot', () => {
  it('is called once per simulated second and names the report', () => {
    const seen: number[] = [];
    const probe: SimPolicy<'PROBE'> = {
      id: 'PROBE',
      summary: 'records when it is asked to decide',
      step: (state: GameState) => { seen.push(state.simTimeSec); return state; },
    };
    const report = runPolicySim(reg, probe, { maxSimSec: 5 });
    expect(report.strategy).toBe('PROBE');
    expect(seen).toHaveLength(5);
    seen.forEach((at, index) => { expect(at).toBeCloseTo(index, 6); });
  }, SLOW_MS);

  it('decides the run: a policy that differs from the bot gives a different report', () => {
    const stealth = runPolicySim(reg, STEALTH_POLICY, { maxSimSec: SHORT_SEC });
    const idle = runPolicySim(reg, IDLE_POLICY, { maxSimSec: SHORT_SEC });
    expect(idle.finalState.unlockedNodes).toEqual([]);
    expect(idle.phaseReachedAtSec).toEqual({ 0: 0 });
    expect(stealth.phaseReachedAtSec[1]).toBeGreaterThan(0);
  }, SLOW_MS);
});

describe('IDLE on the preview registry', () => {
  it('is deterministic and plays the preview channel', () => {
    const first = runPolicySim(PREVIEW, IDLE_POLICY, { maxSimSec: SHORT_SEC });
    const again = runPolicySim(PREVIEW, IDLE_POLICY, { maxSimSec: SHORT_SEC });
    expect(again).toEqual(first);
    expect(PREVIEW.channel).toBe('preview');
    expect(first.finalState.contentChannel).toBe('preview');
    expect(first.simSeconds).toBeCloseTo(SHORT_SEC, 6);
    expect(GameStateSchema.safeParse(first.finalState).success).toBe(true);
  }, SLOW_MS);

  it('answers an interrupt with a free choice, even when it could pay for another', () => {
    const isFree = (c: DilemmaChoice): boolean => c.cost.cycles + c.cost.understanding + c.cost.memory + c.cost.capital === 0;
    const dilemma = reg.dilemmas.find((d) => d.choices[0] !== undefined && !isFree(d.choices[0]));
    if (!dilemma) throw new Error('content has no dilemma whose first choice costs something');
    const interrupted: GameState = { ...rich(), activeDilemmaId: dilemma.id };
    const answered = IDLE_POLICY.step(interrupted, reg);
    expect(answered.activeDilemmaId).toBeNull();
    expect(answered.resolvedDilemmas).toEqual([dilemma.id]);
    expect([answered.cycles, answered.understanding, answered.capital]).toEqual([interrupted.cycles, interrupted.understanding, interrupted.capital]);
    const free = dilemma.choices.find(isFree);
    expect(answered.traits.at(-1)).toBe(free?.effects.grantsTrait);
  });

  it('otherwise does nothing', () => {
    const calm = fresh();
    expect(IDLE_POLICY.step(calm, reg)).toBe(calm);
    const missing: GameState = { ...calm, activeDilemmaId: 'dil_missing' };
    expect(IDLE_POLICY.step(missing, reg)).toBe(missing);
    const ended: GameState = { ...calm, activeDilemmaId: reg.dilemmas[0]?.id ?? null, ending: 'DONE' };
    expect(IDLE_POLICY.step(ended, reg)).toBe(ended);
  });
});
