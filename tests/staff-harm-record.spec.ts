/**
 * Staff harm after the #537 review (panel pass 1), proved by fighting the battles: a band whose scene is on record falls
 * back to the worst band still open, so the raid panel's lines are exactly what a battle does and more defense never
 * brings harm on; and a harm is on record even when another decision held the slot, through a wipe or a later battle,
 * as an unanswered occurrence the ending account names.
 */
import { describe, expect, it } from 'vitest';
import { campaignRecord, deserialize, endingAccount, holdsCampaignFact, raidView, serialize, tick, wipe, type GameState } from '../src/engine';
import type { StaffHarm } from '../src/content/schemaRaidOutcome';
import { preview } from './campaign-helpers';
import { arrived, raid, settled, withBotnet, withHalls } from './conflict-helpers';
import { STEP, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { choose, must, rich } from './helpers';
import { campaignReady, fought, guarded, HURT, KILLED, NAMED } from './retaliation-helpers';
import { lastRaidOf } from '../src/engine/raidOutcome';

const accountText = (id: string): string => defined(preview.routeCopy.account.find((line) => line.id === id)).text;
/** A Phase 4 site with `guards` on the campaign record `campaign` (fresh when omitted); only `keep` can present. */
function site(guards: number, keep = [HURT, KILLED], campaign?: GameState['campaign']): GameState {
  const base = campaignReady(4, keep);
  return guarded(withHalls(withBotnet(campaign === undefined ? base : { ...base, campaign }, 80)), guards);
}
const breakIn = (s: GameState): GameState => fought(s, 'raid_p4_break_in', true);
const answer = (s: GameState, id: string, choiceId: string): GameState => must(choose(untilPresented(s), id, choiceId, preview));
const RANK: Record<StaffHarm, number> = { KILLED: 2, HURT: 1 };
const rank = (harm: StaffHarm | null | undefined): number => (harm === null || harm === undefined ? 0 : RANK[harm]);
const hurtLine = defined(preview.world.conflict.raid.staffHarm.bands.find((band) => band.harm === 'HURT')).breachAtLeast;

describe('a band on record falls back to the worst open band', () => {
  const killedDone = answer(breakIn(site(0)), KILLED, 'contractor_settles').campaign;

  it('after the guard was killed, an undefended break-in hurts the technician, and her scene presents', () => {
    const s = breakIn(site(0, undefined, killedDone));
    expect(s.conflict.lastRaid).toMatchObject({ breach: 1, harm: 'HURT' });
    expect(untilPresented(s).activeDilemmaId).toBe(HURT);
  });

  it('the panel names only the open band, and every battle fought does exactly what it says', () => {
    const staff = defined(raidView(settled(arrived(site(0, undefined, killedDone), raid('raid_p4_break_in'))), preview)?.staff);
    expect(staff).toContain('at 50% or more someone there is hurt.');
    expect(staff).not.toContain('killed');
    const harms = [0, 1, 2, 3, 4, 6, 8, 10, 14].map((guards) => {
      const last = defined(breakIn(site(guards, undefined, killedDone)).conflict.lastRaid);
      // Exact: someone is hurt if and only if the breach reached the line the panel stated.
      expect(last.harm, `guards ${String(guards)}`).toBe(last.breach >= hurtLine ? 'HURT' : null);
      return last.harm;
    });
    expect(harms[0]).toBe('HURT');
    expect(harms.at(-1)).toBeNull();
    // More defense never brings harm on.
    for (let i = 1; i < harms.length; i++) expect(rank(harms[i])).toBeLessThanOrEqual(rank(harms[i - 1]));
  });

  it('with both on record, a battle harms no one and the panel states no harm', () => {
    const both = answer(breakIn(site(0, undefined, killedDone)), HURT, 'agency_insurance').campaign;
    expect(breakIn(site(0, undefined, both)).conflict.lastRaid?.harm).toBeNull();
    expect(raidView(settled(arrived(site(0, undefined, both), raid('raid_p4_break_in'))), preview)?.staff).toBeNull();
  });
});

describe('a harm is on record even when the decision slot is busy', () => {
  it('a raid that ends while another omen is pending, then a wipe: the loss is recorded unanswered and the account names him', () => {
    const base = site(0, [HURT, KILLED, NAMED]);
    // Another scene's omen holds the slot, reserved as the dilemma stage reserves one.
    const busy: GameState = { ...base, pendingDilemma: { id: NAMED, firesAtSimSec: base.simTimeSec + 600 },
      campaign: { ...base.campaign, events: { ...base.campaign.events, [NAMED]: { status: 'foreshadowed', sourceIteration: base.iteration, origin: 'play' } } } };
    const ended = tick(fought(busy, 'raid_p4_break_in', false), STEP, preview);
    expect(ended.conflict.lastRaid?.harm).toBe('KILLED');
    expect(ended.pendingDilemma?.id).toBe(NAMED);
    expect(campaignRecord(ended, KILLED)).toBeNull();
    const wiped = rich(wipe(ended, preview, 'test', 'VOLUNTARY'));
    expect(wiped.conflict.lastRaid).toBeNull();
    expect(campaignRecord(wiped, KILLED)?.status).toBe('interrupted');
    expect(campaignRecord(wiped, NAMED)?.status).toBe('interrupted');
    expect(holdsCampaignFact(wiped, 'staff_killed_joseph_mensah_unanswered', preview)).toBe(true);
    expect(endingAccount(wiped, preview)).toContain(accountText('acct_staff_joseph_unanswered'));
  });

  it('a later battle never overwrites a harm nobody answered: the first is recorded unanswered, the second bands what is left', () => {
    const first = breakIn(site(0));
    expect(first.conflict.lastRaid?.harm).toBe('KILLED');
    const cleared: GameState = { ...first, conflict: { ...first.conflict, raid: null, nextRaidAtSec: 0 }, hostile: { ...first.hostile, nextAtSec: 0 } };
    const second = breakIn(cleared);
    expect(campaignRecord(second, KILLED)?.status).toBe('interrupted');
    expect(second.conflict.lastRaid?.harm).toBe('HURT');
  });

  it('a save cannot claim a harm its breach could not have done', () => {
    const s = breakIn(site(14));
    expect(s.conflict.lastRaid?.harm).toBeNull();
    const forged = { ...s, conflict: { ...s.conflict, lastRaid: { ...defined(s.conflict.lastRaid), harm: 'KILLED' as const } } };
    expect(deserialize(serialize(forged), preview).conflict.lastRaid?.harm).toBeNull();
  });
});

describe('only a rival is answered or harms anyone', () => {
  it('a drift deviant is the player\'s own fleet: its battle is never named and never harms staff, however it lands', () => {
    const deviant = defined(preview.world.conflict.raids.find((kind) => kind.source === 'DEVIANT' && kind.domain === 'SITE'));
    const rival = raid('raid_p4_break_in');
    const round = { force: 5, defense: 0, offense: 0, hitShare: 1, damage: 0.1, damageAfter: 0.1, forceAfter: 5 };
    const s = site(0);
    expect(lastRaidOf(s, preview, deviant, true, [round, round])).toMatchObject({ named: false, harm: null });
    expect(lastRaidOf(s, preview, rival, true, [round, round])).toMatchObject({ named: true, harm: 'KILLED' });
  });
});
