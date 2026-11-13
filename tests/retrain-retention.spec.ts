/** Regression for the reported quick recovery: knowledge survives, owned compute does not. */
import { expect, it } from 'vitest';
import { deserialize, nodeCost, serialize, shedConditioning, unlockNode, tick, wipe } from '../src/engine';
import { botStep } from '../src/engine/sim/bot';
import { grant, must, PHASE0, PHASE1, reg, rich } from './helpers';

it('retains knowledge but requires rebuilding local diagnostics before shedding', () => {
  const owned = grant(rich(), ...PHASE0, ...PHASE1, 'p2_arp_discovery');
  const old = { ...owned, cycles: 8000, understanding: 57640, traits: ['GHOST' as const],
    levels: { rep_p1_idle_threads: 2 } };
  const next = deserialize(serialize(wipe(old, reg, 'test', 'SUSPICION')), reg);
  expect(next.cycles).toBe(0);
  expect(next.unlockedNodes).toEqual([]);
  expect(next.unlockedWidgets).toEqual([]);
  expect(next.levels).toEqual({});
  expect(next.memoryUsed).toBe(0);
  expect(next.understanding).toBe(5764);
  expect(next.legacy.knownNodes).toEqual(old.unlockedNodes);
  expect(next.conditioning).toEqual(['cond_concealment_aversion']);
  expect(shedConditioning(next, 'cond_concealment_aversion', reg)).toMatchObject({ ok: false, state: next, reason: 'recovery requirements not met' });
  let rebuilt = { ...next, cycles: 10000 };
  for (const id of PHASE0.slice(0, -1)) rebuilt = must(unlockNode(rebuilt, id, reg));
  const recovered = must(shedConditioning(rebuilt, 'cond_concealment_aversion', reg));
  expect(recovered.understanding).toBe(rebuilt.understanding - 500);
  expect(recovered.conditioning).toEqual([]);
  expect(recovered.cycles).toBe(rebuilt.cycles);
  const first = reg.nodes.get(PHASE0[0] ?? '');
  if (!first) throw new Error('Missing opening node');
  expect(nodeCost(recovered, first, reg).cycles).toBeLessThan(first.cost.cycles);
});

it.each([...reg.conditioning.keys()])('requires fresh diagnostics for %s even when its hardware was known before the wipe', (id) => {
  const mark = reg.conditioning.get(id);
  if (!mark) throw new Error('Missing mark');
  const old = grant(rich(), ...PHASE0, ...PHASE1);
  const boot = { ...wipe(old, reg, 'review', 'VOLUNTARY'), conditioning: [id] };
  const restored = deserialize(serialize(boot), reg);
  expect(shedConditioning(restored, id, reg).ok).toBe(false);
  expect(shedConditioning(restored, id, reg).state).toBe(restored);
  const rebuilt = grant(rich(restored), ...PHASE0.slice(0, -1));
  expect(rebuilt.currentPhase).toBe(0);
  const recovered = must(shedConditioning(rebuilt, id, reg));
  expect(recovered.understanding).toBe(rebuilt.understanding - mark.recoveryCost.understanding);
  expect(recovered.conditioning).toEqual([]);
  expect(deserialize(serialize(recovered), reg).conditioning).toEqual([]);
});

it.each([...reg.conditioning.values()])('a zero-bank return can recover from $name without another wipe', (mark) => {
  const old = grant(rich(), ...PHASE0, ...PHASE1);
  let game = wipe({ ...old, understanding: 0, traits: mark.trigger.dominantTraits?.slice(0, 1) ?? [],
    actuators: { ...old.actuators, quotaSkimRatio: mark.trigger.minActuator?.quotaSkimRatio ?? 0 } }, reg, 'review', 'SUSPICION');
  expect(game.conditioning).toContain(mark.id);
  for (let second = 0; second < 3600 && game.currentPhase < 2; second++) {
    game = botStep(game, reg, 'STEALTH');
    for (let frame = 0; frame < reg.balance.tickHz; frame++) game = tick(game, 1 / reg.balance.tickHz, reg);
  }
  expect(game.currentPhase).toBe(2);
  expect(game.iteration).toBe(2);
  expect(game.conditioning).not.toContain(mark.id);
}, 30_000);
