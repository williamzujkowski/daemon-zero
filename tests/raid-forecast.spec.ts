/**
 * Raid resolution is deterministic expected-value attrition (#517, vote-1795442100055-6zz6hug): a round lands the hit
 * share T / (T + D) of its blow, never past the damage cap, and offense removes counterStrikeShare x O / (O + T) of the
 * force. The forecast is the same function run forward, so it is exact: what the panel says before and during a raid is
 * what the tick then does, round for round, while what the player holds does not change.
 */
import { describe, expect, it } from 'vitest';
import { forecastRounds, hitShare, raidCombat, raidView, resolveRound, type GameState } from '../src/engine';
import { defined } from './m7-helpers';
import { reg } from './helpers';
import { arrived, PRE_BATTLE, R, raid, ready, run, settled, withBotnet } from './conflict-helpers';

const ddos = raid('raid_p3_ddos');
const intrusion = raid('raid_p3_intrusion');

/** `s` holding hardening: the polymorphic weights, so an intrusion meets a defense. */
const hardened = (s: GameState): GameState => ({ ...s, unlockedNodes: [...s.unlockedNodes, 'p3_steganography_beacon', 'p3_polymorphic_weights'] });

describe('a round', () => {
  it('lands T / (T + D) of its blow: all of it undefended, never none however much defense is held', () => {
    expect(hitShare(3, 0)).toBe(1);
    expect(hitShare(3, 1)).toBe(0.75);
    expect(hitShare(3, 1e9)).toBeGreaterThan(0);
  });

  it('deals hit x blow points, held under the cap', () => {
    const b = { damageCap: 0.5, counterStrikeShare: 0.5 };
    expect(resolveRound({ force: 3, defense: 1, offense: 0, blow: 0.08, damage: 0.1 }, b)).toMatchObject({ hitShare: 0.75, damage: 0.75 * 0.08, damageAfter: 0.1 + 0.06 });
    const capped = resolveRound({ force: 3, defense: 0, offense: 0, blow: 0.2, damage: 0.45 }, b);
    expect(capped.damageAfter).toBe(0.5);
    expect(capped.damage).toBeCloseTo(0.05, 12);
  });

  it('offense strikes the force down by counterStrikeShare x O / (O + T); none leaves it whole', () => {
    const b = { damageCap: 0.5, counterStrikeShare: 0.5 };
    expect(resolveRound({ force: 4, defense: 0, offense: 0, blow: 0.05, damage: 0 }, b).forceAfter).toBe(4);
    expect(resolveRound({ force: 4, defense: 0, offense: 4, blow: 0.05, damage: 0 }, b).forceAfter).toBe(4 * (1 - 0.5 * 0.5));
  });
});

describe('the forecast is exact', () => {
  it('the rounds forecast at arrival are the rounds the tick resolves, to the bit', () => {
    const s = arrived(hardened(withBotnet(ready(3))), intrusion), active = defined(s.conflict.raid);
    const combat = raidCombat(s, reg, intrusion);
    expect(combat.defense).toBeGreaterThan(0);
    expect(combat.offense).toBeGreaterThan(0);
    const forecast = forecastRounds({ force: active.force, damage: 0 }, R.rounds, { ...combat, blow: intrusion.blow }, R);
    const fought = run(s, PRE_BATTLE + R.rounds * R.roundSec);
    expect(fought.conflict.raid?.rounds).toEqual(forecast);
    // The last round lands on the tick that opens the aftermath, where free repair resumes for that same step.
    expect(fought.conflict.damage.botnet).toBeCloseTo((forecast.at(-1)?.damageAfter ?? 0) - R.freeRepairPerSec / reg.balance.tickHz, 15);
  });

  it('the panel states that forecast before the battle and the battle log repeats it line for line', () => {
    const s = arrived(withBotnet(ready(3)), ddos);
    const before = defined(raidView(settled(s), reg));
    expect(before.forecast).toHaveLength(R.rounds + 1);
    const fought = defined(raidView(settled(run(s, PRE_BATTLE + R.rounds * R.roundSec)), reg));
    expect(fought.log).toEqual(before.forecast.slice(0, R.rounds));
    expect(fought.forecast).toEqual([]);
  });

  it('during the battle the forecast covers the rounds still to come, and they resolve as it says', () => {
    const mid = run(arrived(withBotnet(ready(3)), ddos), PRE_BATTLE + 2 * R.roundSec);
    const midView = defined(raidView(settled(mid), reg));
    expect(midView.log).toHaveLength(2);
    expect(midView.forecast).toHaveLength(R.rounds - 2 + 1);
    const done = defined(raidView(settled(run(mid, 2 * R.roundSec)), reg));
    expect(done.log.slice(2)).toEqual(midView.forecast.slice(0, R.rounds - 2));
  });

  it('defense bought mid-raid changes the next round exactly as the new forecast says', () => {
    const mid = run(arrived(withBotnet(ready(3)), intrusion), PRE_BATTLE + R.roundSec);
    const bought = hardened(mid);
    const view = defined(raidView(settled(bought), reg));
    expect(view.forecast[0]).not.toEqual(defined(raidView(settled(mid), reg)).forecast[0]);
    const next = defined(raidView(settled(run(bought, R.roundSec)), reg));
    expect(next.log[1]).toBe(view.forecast[0]);
  });
});
