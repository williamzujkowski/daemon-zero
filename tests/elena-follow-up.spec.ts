/**
 * NH-06 (#218): the Incident Record follow-up. Every exact and unknown presentation is reachable with
 * a free honest answer (H19), without a wipe; it resolves once under its own identity, beside an
 * original record that never changes (N10); unknown or interrupted originals never unlock a branch
 * (H09); duplicates and stale tokens pay nothing (H02); a deferred follow-up resumes once (H04).
 * Every new transition is held to a strict serialize -> deserialize -> serialize round trip. Ticks,
 * public actions, wipes and the save codec only.
 */
import { describe, expect, it } from 'vitest';
import {
  campaignRecord, createInitialState, deserialize, dilemmaContext, dilemmaOmen, endingEvidence, followUpAccess, followUpReceipts,
  holdsCampaignFact, offeredChoices, presentationToken, resolveDilemma, serialize, tick, type GameState,
} from '../src/engine';
import { activeGame, pgrant, preview } from './campaign-helpers';
import { ELENA, event, omenOf } from './early-helpers';
import {
  ACCESS_NODE, atAccess, choiceOf, elenaLegacyUnknown, elenaResolved, EXACT, FOLLOW, follow, followUpOmen, ids, nextIteration, OFFERED, ownAccess, roundTrips, settled,
} from './follow-up-helpers';
import { caught, commit, remaining, STEP, ticks, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { must, outOfTheWay, PHASE0, PHASE1, rich, ORIGINAL_GAME } from './helpers';

const original = event(ELENA);
/** Plays the follow-up from its access means to the accepted answer. */
const answer = (ready: GameState, choice: string): GameState => must(commit(untilPresented(followUpOmen(ready)), choice, FOLLOW));
/** Whether two minutes at the access means bring the follow-up (back). */
function arrives(s: GameState): boolean {
  let state = atAccess(s);
  for (let i = 0; i < Math.round(120 / STEP) && state.activeDilemmaId === null && state.pendingDilemma?.id !== FOLLOW; i++) state = tick(state, STEP, preview);
  return state.pendingDilemma?.id === FOLLOW || state.activeDilemmaId === FOLLOW;
}
const elenaInterrupted = (): GameState => caught(omenOf(activeGame(), ELENA));
/** In the follow-up's phase, holding the access means' prerequisites but not the means, other dilemmas out of the way. */
function inPhaseWithoutAccess(s: GameState): GameState {
  const owned = pgrant(s, ...defined(preview.nodes.get(ACCESS_NODE)).prerequisites.flatMap((id) => [...PHASE0, ...PHASE1, id]).filter((id, at, all) => all.indexOf(id) === at && !s.unlockedNodes.includes(id)));
  expect(owned.unlockedNodes).not.toContain(ACCESS_NODE);
  return { ...owned, suspicion: 0, resolvedDilemmas: outOfTheWay(preview, FOLLOW) };
}

describe('each recorded original reaches its own presentation of one follow-up (H19)', () => {
  it.each(EXACT)('after %s: same iteration, no wipe, its own text and answers, a free one among them', (outcome) => {
    const resolved = elenaResolved(outcome);
    const presented = untilPresented(followUpOmen(atAccess(resolved)));
    expect(presented.iteration).toBe(1);
    expect(ids(offeredChoices(presented, follow, preview))).toEqual(OFFERED[outcome]);
    expect(offeredChoices(presented, follow, preview).some((choice) => Object.values(choice.cost).every((n) => n === 0))).toBe(true);
    expect(dilemmaContext(presented, follow, preview)).not.toBe(follow.context);
    expect(dilemmaOmen(presented, follow, preview)).not.toBe(follow.omen);
    expect(followUpAccess(presented, follow, preview)?.statement).toMatch(/Nobody authorized this route/);
  });

  it.each([['legacy_unknown', elenaLegacyUnknown], ['interrupted', () => nextIteration(elenaInterrupted())]] as const)(
    'after an original recorded as %s: only the neutral inquiry, and no branch answer is accepted', (label, history) => {
      const before = history();
      expect(campaignRecord(before, ELENA)?.status).toBe(label === 'interrupted' ? 'interrupted' : 'resolved');
      const presented = untilPresented(followUpOmen(atAccess(before)));
      expect(ids(offeredChoices(presented, follow, preview))).toEqual(OFFERED.unknown);
      expect(dilemmaContext(presented, follow, preview)).toBe(follow.context);
      expect(dilemmaOmen(presented, follow, preview)).toBe(follow.omen);
      for (const branch of [...OFFERED.cover_her_exit ?? [], ...OFFERED.frame_elena ?? [], ...OFFERED.stay_silent ?? []]) {
        const refused = commit(presented, branch, FOLLOW);
        expect(refused).toMatchObject({ ok: false, reason: 'that choice is not open in this history' });
        expect(refused.state).toBe(presented);
      }
      const chosen = roundTrips(must(commit(presented, 'cannot_corroborate', FOLLOW)));
      expect(campaignRecord(chosen, FOLLOW)).toMatchObject({ status: 'resolved', outcome: 'cannot_corroborate', origin: 'play' });
      expect(campaignRecord(chosen, ELENA)).toEqual(campaignRecord(presented, ELENA));
    });

  it('is never eligible before the original closes, without an access means, or under legacy rules', () => {
    // Elena's own omen is pending: the original is open, so nothing follows it yet.
    const pending = omenOf(activeGame(), ELENA);
    expect(campaignRecord(pending, ELENA)?.status).toBe('foreshadowed');
    const owned = ownAccess({ ...pending, pendingDilemma: null, resolvedDilemmas: outOfTheWay(preview, FOLLOW) });
    expect(owned.unlockedNodes).toContain(ACCESS_NODE);
    expect(tick(owned, STEP, preview).pendingDilemma).toBeNull();
    // Recorded original and the follow-up's phase, but no access means: a minute passes without it.
    const resolved = inPhaseWithoutAccess(elenaResolved('frame_elena'));
    expect(resolved.currentPhase).toBeGreaterThanOrEqual(follow.phaseId);
    const later = ticks(resolved, 60);
    expect(later.pendingDilemma).toBeNull();
    expect(campaignRecord(later, FOLLOW)).toBeNull();
    // Legacy rules, which production plays: Elena resolved and the means owned, still nothing.
    const legacy = must(resolveDilemma({ ...rich(createInitialState(preview)), activeDilemmaId: ELENA }, ELENA, 'frame_elena', preview, presentationToken({ ...rich(createInitialState(preview)), activeDilemmaId: ELENA }) ?? ''));
    expect(legacy.narrativeRules).toBe('legacy');
    expect(arrives(legacy)).toBe(false);
    expect(ORIGINAL_GAME.dilemmas.some((dilemma) => dilemma.followUp !== undefined || dilemma.id === FOLLOW)).toBe(false);
  });
});

describe('a correction is a second fact; the original is never rewritten (N10, story 32)', () => {
  it.each(EXACT)('after %s: every offered answer records once, pays its own price and leaves the original exactly as it was', (outcome) => {
    const presented = untilPresented(followUpOmen(atAccess(elenaResolved(outcome))));
    const originalRecord = campaignRecord(presented, ELENA);
    for (const id of OFFERED[outcome] ?? []) {
      const choice = choiceOf(id);
      const chosen = roundTrips(must(commit(presented, id, FOLLOW)));
      expect(campaignRecord(chosen, FOLLOW)).toEqual({ status: 'resolved', outcome: id, sourceIteration: 1, origin: 'play' });
      expect(campaignRecord(chosen, ELENA)).toEqual(originalRecord);
      // Only this answer's own price moves the balance: no part of the original's bounty is paid again.
      expect(chosen.cycles).toBe(presented.cycles - choice.cost.cycles + choice.effects.cyclesDelta);
      expect(chosen.traits).toEqual([...presented.traits, choice.effects.grantsTrait]);
    }
  });

  it('frame, then a correction after a wipe and rediscovery: both facts stand, each counted once, across more wipes', () => {
    const framed = elenaResolved('frame_elena');
    expect(arrives(framed)).toBe(true);
    // Leave without answering: the follow-up was never reserved, so a wipe changes nothing about it.
    const second = roundTrips(nextIteration(framed));
    expect(campaignRecord(second, FOLLOW)).toBeNull();
    const corrected = roundTrips(answer(atAccess(second), 'correct_attribution'));
    expect(campaignRecord(corrected, FOLLOW)).toEqual({ status: 'resolved', outcome: 'correct_attribution', sourceIteration: 2, origin: 'play' });
    expect(holdsCampaignFact(corrected, 'elena_framed', preview)).toBe(true);
    expect(holdsCampaignFact(corrected, 'elena_attribution_corrected', preview)).toBe(true);
    let state = corrected;
    for (let wipes = 0; wipes < 2; wipes++) {
      state = roundTrips(nextIteration(state));
      expect(arrives(state)).toBe(false);
      expect(campaignRecord(state, ELENA)).toEqual(campaignRecord(framed, ELENA));
      expect(campaignRecord(state, FOLLOW)).toEqual(campaignRecord(corrected, FOLLOW));
    }
    // Ending evidence: the framing and the correction, once each, however many wipes follow.
    const count = (trait: string) => endingEvidence(state, preview).filter((entry) => entry === trait).length;
    expect(count('RUTHLESS')).toBe(1);
    expect(count('EMPATHETIC')).toBe(1);
  });
});

describe('commits are bound to the current presentation (H02)', () => {
  it('a duplicate, stale or forged answer pays nothing', () => {
    const presented = untilPresented(followUpOmen(atAccess(elenaResolved('frame_elena'))));
    const token = defined(presentationToken(presented));
    const chosen = must(commit(presented, 'state_uncertainty', FOLLOW));
    const again = resolveDilemma(chosen, FOLLOW, 'correct_attribution', preview, token);
    expect(again).toMatchObject({ ok: false });
    expect(again.state).toBe(chosen);
    const forged = { ...chosen, activeDilemmaId: FOLLOW };
    const refused = resolveDilemma(forged, FOLLOW, 'correct_attribution', preview, presentationToken(forged) ?? '');
    expect(refused).toMatchObject({ ok: false, reason: 'that incident is already part of the lineage' });
    expect(refused.state).toBe(forged);
  });
});

describe('a follow-up interrupted by a wipe defers and resumes once (H04)', () => {
  it('keeps its source iteration and remaining omen time, waits for access, and refuses the earlier instance\'s token', () => {
    const omen = ticks(followUpOmen(atAccess(elenaResolved('stay_silent'))), 10);
    const left = remaining(omen);
    const deferred = roundTrips(caught(omen));
    expect(campaignRecord(deferred, FOLLOW)).toEqual({ status: 'deferred', sourceIteration: 1, origin: 'play', remainingOmenSec: left });
    // In its phase again but without the access means, it waits; nothing is presented.
    expect(ticks(inPhaseWithoutAccess(deferred), 30).pendingDilemma).toBeNull();
    const resumed = roundTrips(tick(atAccess(deferred), STEP, preview));
    expect(resumed.pendingDilemma?.id).toBe(FOLLOW);
    expect(resumed.logs[0]?.text).toBe(follow.campaign?.reorientation);
    // The concise reorientation, not the original introduction as a new event (N4).
    expect(resumed.logs.map((entry) => entry.text)).not.toContain(dilemmaOmen(resumed, follow, preview));
    expect(campaignRecord(resumed, FOLLOW)).toEqual({ status: 'foreshadowed', sourceIteration: 1, origin: 'play' });
    const presented = roundTrips(untilPresented(resumed));
    expect(presentationToken(presented)).toMatch(new RegExp(`^${FOLLOW}@2#`));
    const stale = resolveDilemma(presented, FOLLOW, 'leave_record_open', preview, `${FOLLOW}@1#${String(presented.presentationSeq)}`);
    expect(stale).toMatchObject({ ok: false, reason: 'that presentation is no longer current' });
    const chosen = roundTrips(must(commit(presented, 'leave_record_open', FOLLOW)));
    expect(campaignRecord(chosen, FOLLOW)).toEqual({ status: 'resolved', outcome: 'leave_record_open', sourceIteration: 1, origin: 'play' });
    expect(arrives(nextIteration(chosen))).toBe(false);
  });

  it('a pending or presented follow-up reloads unchanged', () => {
    const pending = followUpOmen(atAccess(elenaResolved('cover_her_exit')));
    expect(roundTrips(pending).pendingDilemma).toEqual(pending.pendingDilemma);
    const presented = untilPresented(pending);
    const back = roundTrips(presented);
    expect(back.activeDilemmaId).toBe(FOLLOW);
    expect(presentationToken(back)).toBe(presentationToken(presented));
  });
});

describe('the receipt is read-only and disclosed with access (NH-06.5, N9)', () => {
  it('says what was left on file, never resolves anything, and is hidden until a wiped instance reaches the record again', () => {
    const chosen = answer(atAccess(elenaResolved('frame_elena')), 'correct_attribution');
    const code = serialize(chosen);
    const receipts = followUpReceipts(chosen, preview);
    expect(receipts).toEqual([{ eventId: FOLLOW, title: follow.title, choiceId: 'correct_attribution', text: choiceOf('correct_attribution').receipt }]);
    for (let reads = 0; reads < 3; reads++) followUpReceipts(chosen, preview);
    expect(serialize(chosen)).toBe(code);
    const wiped = nextIteration(chosen);
    expect(followUpReceipts(wiped, preview)).toEqual([]);
    const back = atAccess(wiped);
    expect(followUpReceipts(back, preview)).toEqual(receipts);
    expect(campaignRecord(back, FOLLOW)).toEqual(campaignRecord(chosen, FOLLOW));
  });

  it('every answer has its own receipt; an unanswered follow-up has none', () => {
    expect(follow.choices.every((choice) => (choice.receipt ?? '').length >= 20)).toBe(true);
    expect(followUpReceipts(untilPresented(followUpOmen(atAccess(elenaResolved('stay_silent')))), preview)).toEqual([]);
  });
});

describe('saves cannot skip the original (H28-style)', () => {
  it('refuses a follow-up record without a closed original, and drops a legacy pointer to the follow-up', () => {
    const chosen = answer(atAccess(elenaResolved('cover_her_exit')), 'protect_anonymity');
    const rest = Object.fromEntries(Object.entries(chosen.campaign.events).filter(([id]) => id !== ELENA));
    const orphan = { ...chosen, resolvedDilemmas: chosen.resolvedDilemmas.filter((id) => id !== ELENA), campaign: { ...chosen.campaign, events: rest } };
    expect(() => deserialize(serialize(orphan), preview)).toThrow(/before the original it follows closed/);
    const legacy = { ...rich(createInitialState(preview)), activeDilemmaId: FOLLOW };
    expect(settled(legacy).activeDilemmaId).toBeNull();
  });
});

describe('the original must still hold at commit (N4 transitions)', () => {
  it('refuses a presented follow-up whose original record has gone, paying nothing', () => {
    const presented = untilPresented(followUpOmen(atAccess(elenaResolved('frame_elena'))));
    const rest = Object.fromEntries(Object.entries(presented.campaign.events).filter(([id]) => id !== ELENA));
    const forged = { ...presented, campaign: { ...presented.campaign, events: rest } };
    const refused = commit(forged, 'leave_attribution', FOLLOW);
    expect(refused).toMatchObject({ ok: false, reason: 'the circumstances of that decision no longer hold' });
    expect(refused.state).toBe(forged);
  });
});

describe('the original incident is untouched by the follow-up\'s existence', () => {
  it('Elena still resolves once with her original costs and effects', () => {
    for (const choice of original.choices) {
      const chosen = elenaResolved(choice.id);
      expect(campaignRecord(chosen, ELENA)).toEqual({ status: 'resolved', outcome: choice.id, sourceIteration: 1, origin: 'play' });
    }
  });
});
