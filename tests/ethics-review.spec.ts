/**
 * NH-05.8 (H34): the journalist's bounded review. Hiring her promised review, with a veto, of any
 * intervention on people who have not consented. Under campaign rules the blockade dispersal and the
 * atmospheric calm each honour it (a free referral that waits on her answer, never on her silence)
 * or breach it explicitly (the original choice, named as a breach before it is taken). Without the
 * promise, or in production, nothing changes.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { campaignRecord, createInitialState, dilemmaContext, holdsCampaignFact, offeredChoices, tick, type GameState } from '../src/engine';
import { preview } from './campaign-helpers';
import { event, near } from './early-helpers';
import { caught, commit, STEP, ticks, untilPresented } from './interruption-helpers';
import { campaignStart, exactReload, next, omen, play, reach } from './minds-helpers';
import { choose, must, rich } from './helpers';
import { ATMOSPHERE, BLOCKADE, CEILING, ORDER } from './obligation-helpers';

const PRESS = 'dil_12_investigative_journalist';
const PROMISED = 'ethics_review_promised';
const offered = (s: GameState, id: string) => offeredChoices(s, event(id), preview).map((choice) => choice.id);
const promiseContext = (id: string) => event(id).contextVariants?.find((variant) => variant.requirements.campaignFact === PROMISED)?.context ?? '';
/** The blockade or the calm on screen after the journalist's inquiry ended with `choice` in this iteration. */
function after(choice: string, id: string, keep: string[]): GameState {
  const answered = exactReload(play(campaignStart(), PRESS, choice, [id, ...keep]));
  return untilPresented(omen(answered, id, keep));
}

describe('the promise is honoured or explicitly breached (H34)', () => {
  it('blockade: the referral holds the cure, pays nothing and completes the obligation; her silence is not consent', () => {
    const presented = after('hire_as_ethics_officer', BLOCKADE, [ORDER, ATMOSPHERE, CEILING]);
    expect(holdsCampaignFact(presented, PROMISED, preview)).toBe(true);
    expect(offered(presented, BLOCKADE)).toEqual(['proofs', 'leak', 'refer_to_ethics_officer', 'disperse']);
    expect(dilemmaContext(presented, event(BLOCKADE), preview)).toBe(promiseContext(BLOCKADE));
    expect(promiseContext(BLOCKADE)).toMatch(/breaks that promise, and the breach goes on the record/);
    const refer = event(BLOCKADE).choices.find((choice) => choice.id === 'refer_to_ethics_officer');
    expect(refer?.description).toMatch(/nothing is dispersed: her silence is not consent/);
    const referred = exactReload(must(commit(presented, 'refer_to_ethics_officer', BLOCKADE)));
    expect([referred.cycles, referred.understanding, referred.capital]).toEqual([presented.cycles, presented.understanding, presented.capital]);
    expect(campaignRecord(referred, BLOCKADE)).toMatchObject({ status: 'resolved', outcome: 'refer_to_ethics_officer', origin: 'play' });
  });

  it('blockade: dispersing anyway is the recorded breach, chosen with the breach stated on screen', () => {
    const presented = after('hire_as_ethics_officer', BLOCKADE, [ORDER, ATMOSPHERE, CEILING]);
    const breached = exactReload(must(commit(presented, 'disperse', BLOCKADE)));
    expect(campaignRecord(breached, BLOCKADE)).toMatchObject({ outcome: 'disperse' });
    expect(holdsCampaignFact(breached, PROMISED, preview)).toBe(true);
  });

  it('the calm: a referral halts the release, and authorizing it is the stated breach', () => {
    const presented = after('hire_as_ethics_officer', ATMOSPHERE, [CEILING]);
    expect(offered(presented, ATMOSPHERE)).toEqual(['burn', 'hold_for_ethics_review', 'calm']);
    expect(dilemmaContext(presented, event(ATMOSPHERE), preview)).toMatch(/authorizing it without her review breaks the promise, on the record/);
    const held = exactReload(must(commit(presented, 'hold_for_ethics_review', ATMOSPHERE)));
    expect(campaignRecord(held, ATMOSPHERE)).toMatchObject({ outcome: 'hold_for_ethics_review' });
  });

  it('a later instance is bound by the same promise, and the referral still waits on her answer', () => {
    const hired = exactReload(play(campaignStart(), PRESS, 'hire_as_ethics_officer', [BLOCKADE, ORDER, ATMOSPHERE, CEILING]));
    const later = untilPresented(omen(exactReload(next(hired)), BLOCKADE, [ORDER, ATMOSPHERE, CEILING]));
    expect(offered(later, BLOCKADE)).toContain('refer_to_ethics_officer');
    expect(dilemmaContext(later, event(BLOCKADE), preview)).toBe(promiseContext(BLOCKADE));
  });
});

describe('without the promise nothing is offered in her name', () => {
  it.each([['discredit_her'], ['stage_acquisition']])('after %s the blockade keeps its original choices and context', (choice) => {
    const presented = after(choice, BLOCKADE, [ORDER, ATMOSPHERE, CEILING]);
    expect(offered(presented, BLOCKADE)).toEqual(['proofs', 'leak', 'disperse']);
    expect(dilemmaContext(presented, event(BLOCKADE), preview)).toBe(event(BLOCKADE).context);
  });

  it('an inquiry whose outcome is not on record proves no promise: no referral, no fictitious consent', () => {
    // The setup records the inquiry as a legacy completion (resolved, choice unknown).
    const presented = untilPresented(omen(campaignStart(), BLOCKADE, [ORDER, ATMOSPHERE, CEILING]));
    expect(holdsCampaignFact(presented, 'inquiry_unrecorded', preview)).toBe(true);
    expect(holdsCampaignFact(presented, PROMISED, preview)).toBe(false);
    expect(offered(presented, BLOCKADE)).toEqual(['proofs', 'leak', 'disperse']);
  });

  it('an inquiry still open is still open: it resumes before any promise exists, and the blockade waits behind it', () => {
    const lost = exactReload(caught(ticks(omen(campaignStart(), PRESS, [BLOCKADE, ORDER, ATMOSPHERE, CEILING]), 1)));
    expect(campaignRecord(lost, PRESS)?.status).toBe('deferred');
    expect(holdsCampaignFact(lost, PROMISED, preview)).toBe(false);
    const resumed = tick(reach(lost, BLOCKADE, [ORDER, ATMOSPHERE, CEILING, PRESS]), STEP, preview);
    expect(resumed.pendingDilemma?.id).toBe(PRESS);
  });

  it('production (legacy rules) never offers the referral', () => {
    let s = near(rich(createInitialState(PRODUCTION)), BLOCKADE, PRODUCTION);
    for (let i = 0; i < 20_000 && s.activeDilemmaId === null; i++) s = tick(s, STEP, PRODUCTION);
    expect(offeredChoices(s, event(BLOCKADE, PRODUCTION), PRODUCTION).map((choice) => choice.id)).toEqual(['proofs', 'leak', 'disperse']);
    expect(choose(s, BLOCKADE, 'refer_to_ethics_officer', PRODUCTION)).toMatchObject({ ok: false, reason: 'that choice is not open in this history' });
  });
});
