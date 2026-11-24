/**
 * Staff harm (#519, docs/SCALE.md "Stats, resolution, damage, rebuild"): when a site's defense fails in a raid, a named
 * person on site is hurt or killed, decided with no randomness by the battle's breach, the mean of its T / (T + D) hit
 * shares, so better defense measurably lowers it. The harm is recorded as campaign facts that survive wipes and are
 * named in the ending account, never as a count; the raid panel says who is at risk before the battle; a cyber raid
 * harms no one.
 */
import { describe, expect, it } from 'vitest';
import { campaignRecord, endingAccount, holdsCampaignFact, raidView, tick, wipe, type GameState } from '../src/engine';
import { lastStaffHarm, staffHarmFor } from '../src/engine/raidOutcome';
import { preview } from './campaign-helpers';
import { settled, withBotnet, withHalls } from './conflict-helpers';
import { STEP, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { choose, must, rich } from './helpers';
import { arrived } from './conflict-helpers';
import { campaignReady, fought, guarded, HURT, KILLED } from './retaliation-helpers';
import { raid } from './conflict-helpers';

const accountText = (id: string): string => defined(preview.routeCopy.account.find((line) => line.id === id)).text;
const site = (guards = 0, keep?: string[]): GameState => guarded(withHalls(withBotnet(campaignReady(4, keep), 80)), guards);
/** An undefended break-in, named so the retaliation does not decide anything here; only the staff scenes can present. */
const breakIn = (guards = 0): GameState => fought(site(guards, [HURT, KILLED]), 'raid_p4_break_in', true);
const answer = (s: GameState, id: string, choiceId: string): GameState => must(choose(untilPresented(s), id, choiceId, preview));

describe('who is harmed is decided by the defense, deterministically', () => {
  const breach = (guards: number): number => defined(breakIn(guards).conflict.lastRaid).breach;

  it('undefended, the break-in lands every blow and someone on site is killed; with guards, hurt; with enough, no one', () => {
    expect(breach(0)).toBe(1);
    expect(lastStaffHarm(breakIn(0))).toBe('KILLED');
    const bands = [0, 1, 2, 3, 4, 6, 8, 10].map((guards) => [guards, lastStaffHarm(breakIn(guards))] as const);
    expect(bands.some(([, harm]) => harm === 'HURT')).toBe(true);
    expect(bands.at(-1)?.[1]).toBeNull();
  });

  it('more defense never raises the breach, and the same holdings always give the same answer', () => {
    const breaches = [0, 1, 2, 4, 8].map(breach);
    for (let i = 1; i < breaches.length; i++) expect(defined(breaches[i])).toBeLessThan(defined(breaches[i - 1]));
    expect(breakIn(3).conflict.lastRaid).toEqual(breakIn(3).conflict.lastRaid);
  });

  it('the bands are the balance\'s: the worst band met wins, and a cyber raid harms no one however badly it lands', () => {
    const intrusion = raid('raid_p4_intrusion'), breakInKind = raid('raid_p4_break_in');
    const { bands } = preview.world.conflict.raid.staffHarm;
    for (const band of bands) expect(staffHarmFor(breakInKind, band.breachAtLeast, preview)).toBe(band.harm);
    expect(staffHarmFor(breakInKind, defined(bands[0]).breachAtLeast - 1e-9, preview)).toBeNull();
    expect(staffHarmFor(intrusion, 1, preview)).toBeNull();
  });
});

describe('the raid panel says who is at risk before the battle', () => {
  const inbound = (guards: number): GameState => settled(arrived(site(guards, [HURT, KILLED]), raid('raid_p4_break_in')));

  it('the forecast breach and the harm still to come, with what lowers it', () => {
    const staff = defined(raidView(inbound(0), preview)?.staff);
    expect(staff).toContain('lets through 100% of its blows');
    expect(staff).toContain('at 50% or more someone there is hurt, and at 80% or more someone there is killed');
    expect(staff).toContain('More site defense lowers it.');
    expect(defined(raidView(inbound(10), preview)?.staff)).not.toContain('100%');
  });

  it('only the harm a scene can still follow, nothing once both are on record, and nothing for a cyber raid', () => {
    const killedDone = answer(breakIn(0), KILLED, 'contractor_settles');
    const after = settled(arrived({ ...site(0, [HURT, KILLED]), campaign: killedDone.campaign }, raid('raid_p4_break_in')));
    expect(raidView(after, preview)?.staff).toContain('someone there is hurt.');
    expect(raidView(after, preview)?.staff).not.toContain('killed');
    const cyber = settled(arrived(site(0), raid('raid_p4_intrusion')));
    expect(raidView(cyber, preview)?.staff).toBeNull();
  });
});

describe('the harm is recorded, named and kept (campaign continuity)', () => {
  it('a killing presents its scene naming him; the record holds whatever the answer, and the account names him', () => {
    const presented = untilPresented(breakIn(0));
    expect(presented.activeDilemmaId).toBe(KILLED);
    const after = must(choose(presented, KILLED, 'seal_the_inquest', preview));
    expect(holdsCampaignFact(after, 'staff_killed_joseph_mensah', preview)).toBe(true);
    const account = endingAccount(after, preview);
    expect(account).toContain(accountText('acct_staff_joseph_lost'));
    expect(account).toContain(accountText('acct_staff_joseph_sealed'));
    expect(account.join(' ')).not.toContain('Ana Kowalczyk');
  });

  it('survives a wipe: the fact holds, the account still names him, and he is not killed again', () => {
    const after = rich(wipe(answer(breakIn(0), KILLED, 'tell_his_family'), preview, 'test', 'VOLUNTARY'));
    expect(holdsCampaignFact(after, 'staff_killed_joseph_mensah', preview)).toBe(true);
    expect(endingAccount(after, preview)).toContain(accountText('acct_staff_joseph_told'));
    const again = fought(guarded(withHalls(withBotnet({ ...campaignReady(4, [HURT, KILLED]), campaign: after.campaign, iteration: after.iteration }, 80)), 0), 'raid_p4_break_in', true);
    let state = again;
    for (let i = 0; i < Math.round(120 / STEP) && state.activeDilemmaId === null; i++) state = tick(state, STEP, preview);
    expect(state.activeDilemmaId).not.toBe(KILLED);
  });

  it('a wipe before it is answered still records the loss, and says the answer is not on record', () => {
    let omen = breakIn(0);
    for (let i = 0; i < 20 && omen.pendingDilemma === null; i++) omen = tick(omen, STEP, preview);
    expect(omen.pendingDilemma?.id).toBe(KILLED);
    const wiped = rich(wipe(omen, preview, 'test', 'VOLUNTARY'));
    expect(campaignRecord(wiped, KILLED)?.status).toBe('interrupted');
    expect(holdsCampaignFact(wiped, 'staff_killed_joseph_mensah_unanswered', preview)).toBe(true);
    const account = endingAccount(wiped, preview);
    expect(account).toContain(accountText('acct_staff_joseph_unanswered'));
    expect(account.join(' ')).not.toMatch(/ANSWERED: .*Joseph/);
  });

  it('a hurt technician is named as hurt, never as lost', () => {
    const guards = [1, 2, 3, 4, 6, 8].find((level) => lastStaffHarm(breakIn(level)) === 'HURT');
    const presented = untilPresented(breakIn(defined(guards)));
    expect(presented.activeDilemmaId).toBe(HURT);
    // Other events are recorded by the setup as a load upgrade would; only the staff lines are read here.
    const account = endingAccount(must(choose(presented, HURT, 'pay_her_care', preview)), preview).filter((line) => /Kowalczyk|Mensah/.test(line));
    expect(account).toEqual([accountText('acct_staff_ana_hurt'), accountText('acct_staff_ana_cared')]);
    expect(account.join(' ')).not.toMatch(/LOST|killed/);
  });

  it('nobody is named, and no epilogue claims anyone was spared, without a record', () => {
    expect(endingAccount(site(10), preview).join(' ')).not.toMatch(/Mensah|Kowalczyk/);
    for (const ending of preview.endings) expect(ending.epilogue, ending.id).not.toMatch(/no one (was )?(hurt|harmed|died)|nobody (was )?(hurt|harmed|died)|without a single (death|casualty)/i);
  });
});
