/**
 * Site damage and repair (#517): damage is a capped share of a site class's output and never ownership. A COMPUTE
 * class's damage scales only its members' positive compute; an INCOME class's (ransomware) only positive net income.
 * Free repair runs every second except on a class a raid is inbound on or fighting, and while the player is away;
 * paid repair restores a declared chunk at once; a holding that declares repairPerSec adds to the rate (#485's hook).
 */
import { describe, expect, it } from 'vitest';
import { computeRates, conflictReadout, cycleContributions, incomeIntact, repairPerSec, repairSite, repairUnmet, type GameState } from '../src/engine';
import { defined } from './m7-helpers';
import { must, reasonOf, reg } from './helpers';
import { arrived, PRE_BATTLE, R, raid, ready, run, stage, withBotnet, withHalls } from './conflict-helpers';

const damaged = (s: GameState, damage: Record<string, number>): GameState => ({ ...s, conflict: { ...s.conflict, damage } });
const botnetShare = (s: GameState): number => cycleContributions(s, reg).filter((source) => ['p3_botnet_mesh', 'rep_p3_botnet_cells'].includes(source.id))
  .reduce((sum, source) => sum + source.cyclesPerSec, 0);

describe('damage', () => {
  it('scales a class member\'s positive compute by what is left, and nothing else, in the ledger and the rates alike', () => {
    const s = withBotnet(ready(3), 10), hit = damaged(s, { botnet: 0.3 });
    expect(botnetShare(hit)).toBeCloseTo(botnetShare(s) * 0.7, 3);
    expect(computeRates(s, reg).cyclesPerSec - computeRates(hit, reg).cyclesPerSec).toBeCloseTo(botnetShare(s) * 0.3, -10);
    const others = (state: GameState) => cycleContributions(state, reg).filter((source) => !source.id.includes('botnet')).map((source) => source.cyclesPerSec);
    expect(others(hit)).toEqual(others(s));
    expect(computeRates(hit, reg).capitalPerSec).toBe(computeRates(s, reg).capitalPerSec);
  });

  it('on the books takes that share of positive net income, and never touches a deficit', () => {
    const earning = { ...ready(3), unlockedNodes: [...ready(3).unlockedNodes, 'p3_steganography_beacon', 'p3_polymorphic_weights', 'p3_shell_company_finances'] };
    const income = computeRates(earning, reg).capitalPerSec;
    expect(income).toBeGreaterThan(0);
    expect(computeRates(damaged(earning, { books: 0.25 }), reg).capitalPerSec).toBeCloseTo(income * 0.75, 6);
    expect(incomeIntact(damaged(earning, { books: 0.25 }), reg)).toBe(0.75);
    const losing = { ...ready(4), levels: { ...ready(4).levels, op_blind_ceo: 3 } };
    expect(computeRates(losing, reg).capitalPerSec).toBeLessThan(0);
    expect(computeRates(damaged(losing, { books: 0.5 }), reg).capitalPerSec).toBe(computeRates(losing, reg).capitalPerSec);
  });

  it('is never carried past the cap, however many rounds land', () => {
    let s = withBotnet(ready(3));
    for (let n = 0; n < 6; n++) {
      s = run(arrived({ ...s, conflict: { ...s.conflict, raid: null, nextRaidAtSec: 0 }, hostile: { ...s.hostile, nextAtSec: 0 } }, raid('raid_p3_ddos')), PRE_BATTLE + R.rounds * R.roundSec);
      expect(s.conflict.damage.botnet ?? 0).toBeLessThanOrEqual(R.damageCap);
    }
    expect(s.conflict.damage.botnet).toBeCloseTo(R.damageCap - R.freeRepairPerSec / reg.balance.tickHz, 12);
  });
});

describe('free repair', () => {
  it('restores freeRepairPerSec points every second, down to nothing', () => {
    // The mesh alone borrows no watts, so no raid arrives while it repairs.
    const s = damaged(withBotnet(ready(3), 0), { botnet: 0.1 });
    expect(run(s, 100).conflict.damage.botnet).toBeCloseTo(0.1 - 100 * R.freeRepairPerSec, 9);
    expect(run(damaged(s, { botnet: 0.001 }), 100).conflict.damage).toEqual({});
  });

  it('waits on the class a raid is inbound on or fighting, and resumes in the aftermath', () => {
    const s = arrived(damaged(withBotnet(ready(3)), { botnet: 0.1, implants: 0.1 }), raid('raid_p3_ddos'));
    const inbound = run(s, 10);
    expect(inbound.conflict.damage.botnet).toBe(0.1);
    expect(inbound.conflict.damage.implants).toBeCloseTo((s.conflict.damage.implants ?? 0) - 10 * R.freeRepairPerSec, 9);
    const aftermath = run(s, PRE_BATTLE + R.rounds * R.roundSec);
    expect(run(aftermath, 10).conflict.damage.botnet).toBeCloseTo((aftermath.conflict.damage.botnet ?? 0) - 10 * R.freeRepairPerSec, 9);
  });

  it('runs while the player is away, because it only helps', () => {
    expect(stage(damaged(withBotnet(ready(3), 0), { botnet: 0.1 }), 60, true).conflict.damage.botnet).toBeCloseTo(0.1 - 60 * R.freeRepairPerSec, 9);
  });

  it('is faster for every running holding that declares repairPerSec: humanoid site crews (#485) are the robots that repair', () => {
    const crews = defined(reg.world.conflict.holdings.find((entry) => entry.repeatable === 'rep_p4_humanoid_crews')).repairPerSec ?? 0;
    expect(crews).toBeGreaterThan(0);
    const s = { ...ready(4), levels: { ...ready(4).levels, rep_p4_humanoid_crews: 4 } };
    expect(repairPerSec(ready(4), reg)).toBe(R.freeRepairPerSec);
    expect(repairPerSec(s, reg)).toBeCloseTo(R.freeRepairPerSec + 4 * crews, 12);
    expect(run(damaged(s, { halls: 0.1 }), 10).conflict.damage.halls).toBeCloseTo(0.1 - 10 * (R.freeRepairPerSec + 4 * crews), 9);
  });
});

describe('paid repair', () => {
  const halls = defined(reg.world.conflict.siteClasses.find((cls) => cls.id === 'halls'));

  it('pays the class price and restores its points at once, with a line that says so', () => {
    const s = damaged(withHalls(ready(4)), { halls: 0.3 });
    const d = must(repairSite(s, 'halls', reg));
    expect(d.conflict.damage.halls).toBeCloseTo(0.3 - halls.repair.points, 12);
    expect(d.capital).toBe(s.capital - halls.repair.cost.capital);
    expect(d.logs[0]?.text).toBe('Data halls: repair crews restore 15 points of output, 15% damaged now.');
    expect(must(repairSite(damaged(s, { halls: 0.05 }), 'halls', reg)).conflict.damage).toEqual({});
  });

  it('is refused, with every reason, when nothing is damaged, while a raid is on it, or when it cannot be paid', () => {
    expect(repairUnmet(withHalls(ready(4)), 'halls', reg)).toEqual(['Nothing in data halls is damaged.']);
    const raided = arrived(damaged(withBotnet(ready(3)), { botnet: 0.2 }), raid('raid_p3_ddos'));
    expect(reasonOf(repairSite(raided, 'botnet', reg))).toBe('A raid is still on botnet cells: repair waits for its aftermath.');
    const broke = { ...damaged(withHalls(ready(4)), { halls: 0.3 }), capital: 0 };
    expect(repairUnmet(broke, 'halls', reg)).toEqual(['Insufficient resources: ' + '$60M']);
    expect(reasonOf(repairSite(ready(4), 'no_such_class', reg))).toBe('No such site class.');
  });

  it('is offered in the readout with its price, only for a class that is damaged', () => {
    const view = conflictReadout(damaged(withHalls(ready(4)), { halls: 0.3 }), reg);
    const site = defined(view.find((domain) => domain.id === 'SITE'));
    expect(site.classes.map((cls) => cls.id)).toEqual(['halls']);
    expect(defined(site.classes[0]).repair).toMatchObject({ costLabel: '$60M', eligible: true, unmet: [] });
    expect(defined(site.classes[0]).text).toBe('Data halls: its holdings deliver 30% less compute. Free repair restores 0.6 points a minute: clear in 3000 s.');
  });
});
