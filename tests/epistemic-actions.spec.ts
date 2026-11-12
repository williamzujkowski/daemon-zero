import { defined } from './m7-helpers';
/** Record edits are gated, priced once, capped and mutually exclusive without content IDs in engine code. */
import { describe, expect, it } from 'vitest';
import { actionAvailable, actionCost, actionExhausted, computeRates, cycleContributions, isNodeAvailable, meetsRequirements, performAction, resolveDilemma, tick, type GameState } from '../src/engine';
import { actionOutputs } from '../src/engine/swarmRates';
import { fresh, grant, must, PHASE0, PHASE1, reg, rich, withoutDilemmas } from './helpers';
const ready = () => withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1));
const actions = [...reg.actions.values()].filter((action) => action.requirements.requiresSurveillance);

describe('epistemic actions', () => {
  it('requires decoded surveillance and checks every additional declarative gate', () => {
    for (const action of actions) expect(performAction(rich(), action.id, reg).ok).toBe(false);
    const s = ready();
    expect(meetsRequirements(s, { requiresSurveillance: true })).toBe(false);
    expect(meetsRequirements(s, { minEpistemicDrift: 10 }, reg)).toBe(false);
    expect(meetsRequirements(s, { requiredNarrativeFlag: 'unknown' }, reg)).toBe(false);
    expect(meetsRequirements(s, { requiresActiveConditioningMark: true }, reg)).toBe(false);
    expect(meetsRequirements(s, { requiresMaxDriftShardAnomaly: true }, reg)).toBe(false);
    expect(meetsRequirements(s, { requiresSurveillance: true }, reg)).toBe(true);
  });
  it('reclassifies only in the authored 20–74 band and observes cooldown', () => {
    const a = defined(actions.find((action) => action.effects.suspicionDelta === -22));
    for (const suspicion of [19.99, 74.01]) expect(performAction({ ...ready(), suspicion }, a.id, reg).ok).toBe(false);
    const s = { ...ready(), suspicion: 40 };
    const next = must(performAction(s, a.id, reg));
    expect(next.suspicion).toBe(18); expect(next.epistemicDrift).toBe(12);
    expect(next.cycles).toBe(s.cycles - a.cost.cycles);
    expect(performAction(next, a.id, reg).ok).toBe(false);
  });
  it('caps memory purchases at three and preserves effects after exhaustion', () => {
    const a = defined(actions.find((action) => action.maxPurchases === 3));
    let s = { ...ready(), thermal: 60 }; const before = s;
    for (let i = 0; i < 3; i++) { s = must(performAction(s, a.id, reg)); s = { ...s, simTimeSec: s.simTimeSec + a.cooldownSec }; }
    expect(s.memoryCap).toBe(before.memoryCap + 768); expect(s.thermal).toBe(36);
    expect(actionExhausted(s, a)).toBe(true); expect(actionAvailable(s, a, reg)).toBe(false);
    expect(performAction(s, a.id, reg)).toMatchObject({ ok: false, state: s });
  });
  it('makes successor paths exclusive and grants continuous rates while owned', () => {
    for (const a of actions.filter((action) => action.exclusiveWith)) {
      const s = ready(); const next = must(performAction(s, a.id, reg));
      expect(actionExhausted(next, a)).toBe(true);
      expect(next.narrativeFlags).toContain(a.effects.setsNarrativeFlag);
      expect(computeRates(next, reg).cyclesPerSec - computeRates(s, reg).cyclesPerSec).toBeCloseTo(defined(a.tickDelta).cyclesPerSec);
      expect(computeRates(next, reg).understandingPerSec - computeRates(s, reg).understandingPerSec).toBeCloseTo(defined(a.tickDelta).understandingPerSec);
      expect(performAction(next, defined(defined(a.exclusiveWith)[0]), reg).ok).toBe(false);
      expect(actionAvailable({ ...s, actionCounts: { [defined(defined(a.exclusiveWith)[0])]: 1 } }, a, reg)).toBe(false);
    }
  });
  it('expires temporary output at the boundary and does not stack refreshes', () => {
    const a = defined(actions.find((action) => action.durationSec));
    const s = ready(); const next = must(performAction(s, a.id, reg));
    expect(computeRates(next, reg).suspicionPerSec - computeRates(s, reg).suspicionPerSec).toBeCloseTo(-.04);
    expect(actionOutputs({ ...next, simTimeSec: defined(a.durationSec) }, reg)).toEqual([]);
    expect(defined(actionOutputs({ ...next, actionCounts: { [a.id]: 3 } }, reg)[0]).count).toBe(1);
  });
  it('removes only the oldest mark at a 35 percent Understanding discount', () => {
    const a = defined(actions.find((action) => action.conditioningDiscount !== undefined));
    const marks = [...reg.conditioning.values()].slice(0, 2);
    const s = { ...ready(), conditioning: marks.map((mark) => mark.id) };
    const cost = actionCost(s, a, reg);
    expect(cost.understanding).toBe(Math.ceil(defined(marks[0]).recoveryCost.understanding * .65));
    const next = must(performAction(s, a.id, reg));
    expect(next.conditioning).toEqual([defined(marks[1]).id]); expect(next.epistemicDrift).toBe(18);
    expect(actionCost(fresh(), a, reg)).toEqual(a.cost);
    expect(actionCost({ ...s, conditioning: ['missing'] }, a, reg)).toEqual(a.cost);
  });
  it('uses a 45-second omen for hallway and successor dilemmas and records choices', () => {
    const cases = reg.dilemmas.filter((dilemma) => dilemma.trigger.minEpistemicDrift !== undefined || dilemma.trigger.requiredNarrativeFlag !== undefined);
    for (const dilemma of cases) for (const choice of dilemma.choices) {
      let s: GameState = { ...ready(), currentPhase: 3, epistemicDrift: 35,
        narrativeFlags: dilemma.trigger.requiredNarrativeFlag ? [dilemma.trigger.requiredNarrativeFlag] : [],
        resolvedDilemmas: reg.dilemmas.filter((entry) => entry.id !== dilemma.id).map((entry) => entry.id) };
      s = tick(s, .1, reg); expect(defined(s.pendingDilemma).firesAtSimSec - s.simTimeSec).toBe(45);
      s = tick(s, 45, reg); expect(s.activeDilemmaId).toBe(dilemma.id);
      expect(must(resolveDilemma(s, dilemma.id, choice.id, reg)).traits).toContain(choice.effects.grantsTrait);
    }
  });
});

it('shares decoded gates and rate-source arithmetic with generic node and ledger queries', () => {
  const node = defined(reg.nodes.get(reg.nodeOrder[0] ?? ''));
  const gated = { ...node, requirements: { requiresSurveillance: true } };
  expect(isNodeAvailable(fresh(), gated, reg)).toBe(false);
  const known = { ...fresh(), legacy: { ...fresh().legacy, knownNodes: ready().unlockedNodes } };
  expect(isNodeAvailable(known, gated, reg)).toBe(true);
  const action = defined(actions.find((entry) => entry.tickDelta?.cyclesPerSec === 25));
  const state = must(performAction(ready(), action.id, reg));
  expect(cycleContributions(state, reg).reduce((sum, source) => sum + source.cyclesPerSec, 0)).toBeCloseTo(computeRates(state, reg).cyclesPerSec);
});
