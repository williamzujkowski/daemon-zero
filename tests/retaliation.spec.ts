/**
 * Retaliation (#519, vote-1795442208800-kll72ri) as content on the dilemma path: a battle leaves a record; once
 * attribution has named the attacker, the scene that answers it is presented (its own machines, or people's), naming
 * it; each answer's effects reach the raider and nothing the player or anyone else holds; a silenced raider stays
 * silenced across wipes; a loud answer draws the next raid closer; and an unnamed raid is never answered.
 */
import { describe, expect, it } from 'vitest';
import { computeRates, dilemmaContext, dilemmaOmen, eligibleRaids, choiceText, tick, type GameState } from '../src/engine';
import { breachOf } from '../src/engine/raidOutcome';
import { preview } from './campaign-helpers';
import { withBotnet, withHalls, texts } from './conflict-helpers';
import { STEP } from './interruption-helpers';
import { defined } from './m7-helpers';
import { must, choose } from './helpers';
import { next } from './minds-helpers';
import { AMONG, campaignReady, fought, NAMED } from './retaliation-helpers';

const scene = (id: string) => defined(preview.dilemmas.find((entry) => entry.id === id));
const attackerOf = (id: string) => defined(preview.world.conflict.raids.find((kind) => kind.id === id)).attacker;

/** The scene presented next, or null if none is within two minutes of play. */
function presentedWithin(s: GameState, seconds = 120): GameState | null {
  let state = s;
  for (let i = 0; i < Math.round(seconds / STEP) && state.activeDilemmaId === null; i++) state = tick(state, STEP, preview);
  return state.activeDilemmaId === null ? null : state;
}

/** A Phase 3 mind whose botnet draws raiders, after a named flood by HAILSTORM, whose botnet is people's routers. */
const afterFlood = (named = true): GameState => fought(withBotnet(campaignReady(3)), 'raid_p3_ddos', named);
/** A Phase 4 mind after a named supply-chain intrusion by CINDER STACK, which runs on machines of its own. */
const afterCinder = (): GameState => fought(withHalls(withBotnet(campaignReady(4), 80)), 'raid_p4_intrusion', true);

describe('a battle leaves a record', () => {
  it('when its last round lands: the raid, whether attribution named it, and its breach, the mean hit share of its rounds', () => {
    const s = afterFlood();
    const raid = defined(s.conflict.raid);
    expect(raid.stage).toBe('AFTERMATH');
    const mean = raid.rounds.reduce((sum, round) => sum + round.hitShare, 0) / raid.rounds.length;
    expect(s.conflict.lastRaid).toEqual({ id: 'raid_p3_ddos', named: true, breach: mean, harm: null });
    expect(breachOf([])).toBe(0);
    expect(afterFlood(false).conflict.lastRaid?.named).toBe(false);
  });

  it('a wipe clears the record and keeps nothing else of the battle', () => {
    expect(next(afterFlood()).conflict.lastRaid).toBeNull();
  });
});

describe('the scene that answers a named raider', () => {
  it('for a raider among people: the collateral scene, naming it and what it runs among, in omen, context and every choice', () => {
    const s = defined(presentedWithin(afterFlood()));
    expect(s.activeDilemmaId).toBe(AMONG);
    const { name, collateral } = attackerOf('raid_p3_ddos');
    const context = dilemmaContext(s, scene(AMONG), preview);
    expect(context).toContain(name);
    expect(context).toContain(defined(collateral));
    expect(texts(s).some((line) => line === dilemmaOmen(s, scene(AMONG), preview) && line.includes(name))).toBe(true);
    for (const choice of scene(AMONG).choices) {
      const words = choiceText(s, scene(AMONG), choice, preview);
      expect(Object.values(words).join(' ')).not.toMatch(/\{[a-z]+\}/);
    }
    expect(context).not.toMatch(/\{[a-z]+\}/);
  });

  it('for a raider on its own machines: the other scene, with no collateral to state', () => {
    const s = defined(presentedWithin(afterCinder()));
    expect(s.activeDilemmaId).toBe(NAMED);
    expect(dilemmaContext(s, scene(NAMED), preview)).toContain(attackerOf('raid_p4_intrusion').name);
    expect(attackerOf('raid_p4_intrusion').collateral).toBeUndefined();
  });

  it('never for a raider attribution did not name', () => {
    expect(presentedWithin(afterFlood(false))).toBeNull();
  });

  it('once in a campaign: a second named raider, after a wipe, is not answered again', () => {
    const answered = must(choose(defined(presentedWithin(afterFlood())), AMONG, 'absorb', preview));
    // The same campaign record on a mind ready for another raid: LATTICE-9 also runs among people's machines.
    const later = (base: GameState): GameState => fought(withBotnet({ ...campaignReady(3), campaign: base.campaign, iteration: base.iteration }), 'raid_p3_intrusion', true);
    expect(later(answered).conflict.lastRaid).toMatchObject({ id: 'raid_p3_intrusion', named: true });
    expect(presentedWithin(later(answered))).toBeNull();
    expect(presentedWithin(later(next(answered)))).toBeNull();
  });
});

describe('what each answer does', () => {
  const presented = defined(presentedWithin(afterFlood()));
  const answer = (choiceId: string): GameState => must(choose(presented, AMONG, choiceId, preview));
  const eligible = (s: GameState): string[] => eligibleRaids(s, computeRates(s, preview), preview).map((kind) => kind.id);

  it.each(['warn_the_owners', 'strike_host_by_host', 'strike_through', 'take_its_place', 'scorch_substrate'])(
    '%s silences the raider for good: the rotation never draws it again, even after a wipe', (choiceId) => {
      const after = answer(choiceId);
      expect(after.conflict.silenced).toEqual(['raid_p3_ddos']);
      expect(eligible(presented)).toContain('raid_p3_ddos');
      expect(eligible(after)).not.toContain('raid_p3_ddos');
      expect(eligible(withBotnet({ ...next(after), currentPhase: 3 }))).not.toContain('raid_p3_ddos');
    });

  it('absorbing leaves it in the rotation, moves no clock and adds no trace', () => {
    const after = answer('absorb');
    expect(after.conflict.silenced).toEqual([]);
    expect(after.conflict.nextRaidAtSec).toBe(presented.conflict.nextRaidAtSec);
    expect(after.suspicion).toBe(presented.suspicion);
  });

  it.each(['strike_host_by_host', 'strike_through', 'scorch_substrate'])('%s is loud: the next raid may come sooner by its delta, never before now', (choiceId) => {
    const fx = defined(scene(AMONG).choices.find((entry) => entry.id === choiceId)).effects;
    const after = answer(choiceId);
    const base = Math.max(presented.conflict.nextRaidAtSec, presented.simTimeSec);
    expect(after.conflict.nextRaidAtSec).toBe(Math.max(presented.simTimeSec, base + defined(fx.nextRaidDeltaSec)));
    expect(after.conflict.nextRaidAtSec).toBeLessThan(presented.conflict.nextRaidAtSec);
    expect(after.suspicion).toBeGreaterThan(presented.suspicion);
  });

  it.each(scene(AMONG).choices.map((entry) => entry.id))('%s reaches only the raider: no node, level, damage, cohort or arrangement changes', (choiceId) => {
    const after = answer(choiceId);
    for (const key of ['unlockedNodes', 'disabledNodes', 'levels', 'activeShards', 'access', 'hostile'] as const) expect(after[key], key).toEqual(presented[key]);
    expect(after.conflict.damage).toEqual(presented.conflict.damage);
  });

  it('an answer with a free option for the broke: absorbing commits with nothing in the bank', () => {
    const broke = { ...presented, cycles: 0, understanding: 0, capital: 0 };
    expect(choose(broke, AMONG, 'absorb', preview).ok).toBe(true);
    expect(choose(broke, AMONG, 'strike_host_by_host', preview).ok).toBe(false);
  });

  it('the log names what was answered', () => {
    expect(texts(answer('strike_through'))[0]).toContain(attackerOf('raid_p3_ddos').name);
  });
});
