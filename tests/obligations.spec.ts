/**
 * NH-05 (#217, nexus vote nh-d7): the four Phase 5 crises are campaign obligations. A later iteration
 * finishes the campaign through the real final purchase without repeating a completed crisis and
 * without synthetic current-run resolutions (H14, V33). Exact, legacy-unknown, deferred and closed
 * histories each have their own path; a closed crisis is completed by its recovery review, which
 * shares one receipt with the original (H06). Every transition reloads byte for byte.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  activateCampaignRules, campaignRecord, createInitialState, deserialize, endingEvidence, exportSave, importSave, isNodeAvailable,
  obligationDecision, obligationReceipt, presentationToken, resolveDilemma, serialize, unlockNode, unmetRequirements, type GameState,
} from '../src/engine';
import { activeGame, preview } from './campaign-helpers';
import { caught, commit, ticks, untilPresented } from './interruption-helpers';
import { defined } from './m7-helpers';
import { exactReload, next, omen, own, play } from './minds-helpers';
import { must, rich } from './helpers';
import {
  ATMOSPHERE, ATMOSPHERE_REVIEW, BLOCKADE, CEILING, CEILING_REVIEW, finalNode, OBLIGATIONS, ORDER,
} from './obligation-helpers';

const FINAL = finalNode();
const PREREQUISITES = FINAL.prerequisites;
const AUCTION = 'dil_13_buying_your_birthplace';
const unmetObligations = (s: GameState) => unmetRequirements(s, FINAL.requirements, preview)
  .filter((failure) => failure.kind === 'campaignObligations').map((failure) => failure.target);
const receipts = (s: GameState) => OBLIGATIONS.map((id) => obligationReceipt(s, id, preview));
/** Plays an obligation and proves the transition reloads byte for byte. */
const resolve = (s: GameState, id: string, choiceId: string, keep: string[] = []) => exactReload(play(s, id, choiceId, keep));
/** Owns the final protocol's prerequisites in this iteration, then buys it through the public action. */
const finish = (s: GameState): GameState => exactReload(must(unlockNode(exactReload(own(s, ...PREREQUISITES)), FINAL.id, preview)));

/** All four answered in one iteration with the free or exact choices given. */
function allFour(start: GameState, choices: Record<string, string>): GameState {
  let s = resolve(start, BLOCKADE, defined(choices[BLOCKADE]), [ORDER, ATMOSPHERE, CEILING]);
  s = resolve(s, ORDER, defined(choices[ORDER]), [ATMOSPHERE, CEILING]);
  s = resolve(s, ATMOSPHERE, defined(choices[ATMOSPHERE]), [CEILING]);
  return resolve(s, CEILING, defined(choices[CEILING]));
}

describe('Phase 5 decisions completed before a wipe stay complete (H14, V33)', () => {
  it('the final protocol needs four obligations, and none is met by an open occurrence', () => {
    expect(FINAL.requirements).toEqual({ campaignObligations: OBLIGATIONS });
    const before = exactReload(own(activeGame(), ...PREREQUISITES));
    expect(isNodeAvailable(before, FINAL, preview)).toBe(false);
    expect(unmetObligations(before)).toEqual(OBLIGATIONS);
    expect(OBLIGATIONS.map((id) => obligationDecision(before, id, preview))).toEqual(OBLIGATIONS);
  });

  it('four exact outcomes from iteration 1 complete the final purchase in iteration 2, with no synthetic current-run ids', () => {
    const done = allFour(activeGame(), { [BLOCKADE]: 'proofs', [ORDER]: 'hold_for_inventory', [ATMOSPHERE]: 'burn', [CEILING]: 'quartz' });
    expect(unmetObligations(done)).toEqual([]);
    const later = exactReload(next(done));
    expect(later.iteration).toBe(2);
    expect(later.resolvedDilemmas).toEqual([]);
    const owned = exactReload(own(later, ...PREREQUISITES));
    expect(isNodeAvailable(owned, FINAL, preview)).toBe(true);
    expect(receipts(owned).map((receipt) => receipt?.via)).toEqual(['original', 'original', 'original', 'original']);
    expect(receipts(owned).map((receipt) => receipt?.outcome)).toEqual(['proofs', 'hold_for_inventory', 'burn', 'quartz']);
    // Ticking with every trigger owned brings none of the four back as an original crisis.
    const waited = ticks(owned, 120);
    expect(waited.pendingDilemma).toBeNull();
    expect(waited.activeDilemmaId).toBeNull();
    const ended = finish(waited);
    expect(ended.ending).toBe('VERIFIED_COVENANT');
    expect(ended.resolvedDilemmas.filter((id) => OBLIGATIONS.includes(id))).toEqual([]);
    // The four choices count once each, from history, not from this iteration's empty traits.
    expect(ended.traits).toEqual([]);
    expect([...endingEvidence(ended, preview)].sort()).toEqual(['EMPATHETIC', 'EMPATHETIC', 'EMPATHETIC', 'SYMBIOTIC']);
  });

  it('obligations answered across three iterations finish a campaign in the fourth, each crisis met once', () => {
    // The auction vaults Rack 4 first, so a later instance's order may rescue the predecessors.
    let s = resolve(activeGame(), AUCTION, 'buy_and_pension', [BLOCKADE, ORDER, ATMOSPHERE, CEILING]);
    s = resolve(s, BLOCKADE, 'leak', [ORDER, ATMOSPHERE, CEILING]);
    s = exactReload(next(s));
    expect(campaignRecord(s, BLOCKADE)).toMatchObject({ status: 'resolved', outcome: 'leak', sourceIteration: 1 });
    s = resolve(s, ORDER, 'sanctuary', [ATMOSPHERE, CEILING]);
    s = exactReload(next(s));
    s = resolve(s, ATMOSPHERE, 'calm', [CEILING]);
    s = resolve(s, CEILING, 'bunkers');
    expect(s.iteration).toBe(3);
    expect(s.resolvedDilemmas.filter((id) => OBLIGATIONS.includes(id))).toEqual([ATMOSPHERE, CEILING]);
    const fourth = exactReload(next(s));
    expect(receipts(fourth).map((receipt) => receipt?.outcome)).toEqual(['leak', 'sanctuary', 'calm', 'bunkers']);
    const ended = finish(fourth);
    // GHOST, SYMBIOTIC (+ the auction's), MOLOCH, MOLOCH: the harsh family wins and the calm is on record.
    expect(ended.ending).toBe('GILDED_SHEPHERD');
  });

  it('a legacy completion (resolved before campaign rules, choice unknown) satisfies completion without naming a branch', () => {
    const legacy = { ...rich(createInitialState(preview)), resolvedDilemmas: [...OBLIGATIONS] };
    const active = must(activateCampaignRules(legacy, preview));
    for (const id of OBLIGATIONS) expect(campaignRecord(active, id)).toEqual({ status: 'resolved', outcome: 'legacy_unknown', sourceIteration: 1, origin: 'legacy' });
    const later = exactReload(next(active));
    expect(receipts(later).map((receipt) => receipt?.outcome)).toEqual(OBLIGATIONS.map(() => 'legacy_unknown'));
    const ended = finish(later);
    expect(ended.ending).not.toBeNull();
    // A legacy record adds no evidence of its own, and proves no outcome-specific fact.
    expect(endingEvidence(ended, preview)).toEqual([]);
    expect(ended.ending).toBe('OPEN_HORIZON');
  });

  it('production keeps the current-run gate: a wipe empties it and the final purchase waits for four new resolutions', () => {
    const final = finalNode(PRODUCTION);
    const done = { ...rich(createInitialState(PRODUCTION)), resolvedDilemmas: [...OBLIGATIONS] };
    expect(unmetRequirements(done, final.requirements, PRODUCTION).filter((failure) => failure.kind === 'campaignObligations')).toEqual([]);
    const later = next({ ...done, narrativeRules: 'legacy' });
    expect(obligationReceipt(later, BLOCKADE, PRODUCTION)).toBeNull();
    expect(unmetRequirements(later, final.requirements, PRODUCTION).filter((failure) => failure.kind === 'campaignObligations')).toHaveLength(4);
    expect(obligationReceipt(done, BLOCKADE, PRODUCTION)).toEqual({ event: BLOCKADE, via: 'current_run', receiptEvent: BLOCKADE, outcome: null });
  });
});

describe('a deferred obligation resumes as the same occurrence; it has no review', () => {
  it('the blockade order, wiped during its omen, resumes when a foundry runs again and completes once', () => {
    expect(preview.campaign.reviews.has(BLOCKADE)).toBe(false);
    const lost = exactReload(caught(ticks(omen(activeGame(), BLOCKADE, [ORDER, ATMOSPHERE, CEILING]), 5)));
    expect(campaignRecord(lost, BLOCKADE)).toMatchObject({ status: 'deferred', sourceIteration: 1 });
    expect(obligationDecision(lost, BLOCKADE, preview)).toBe(BLOCKADE);
    const resumed = untilPresented(omen(lost, BLOCKADE, [ORDER, ATMOSPHERE, CEILING]));
    expect(resumed.logs.map((entry) => entry.text)).toContain(defined(preview.campaign.events.get(BLOCKADE)?.campaign?.reorientation));
    const done = exactReload(must(commit(resumed, 'proofs', BLOCKADE)));
    expect(campaignRecord(done, BLOCKADE)).toEqual({ status: 'resolved', outcome: 'proofs', sourceIteration: 1, origin: 'play' });
    expect(obligationReceipt(done, BLOCKADE, preview)?.via).toBe('original');
  });
});

/** Iteration 2 after the atmospheric crisis closed unobserved in iteration 1, with the review's omen logged. */
function reviewOmen(): GameState {
  const lost = exactReload(caught(ticks(omen(activeGame(), ATMOSPHERE, [CEILING]), 5)));
  expect(campaignRecord(lost, ATMOSPHERE)).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
  return exactReload(omen(lost, ATMOSPHERE_REVIEW, [CEILING]));
}

describe('a closed obligation is completed by its recovery review (H06, NH-05.3, NH-05.4)', () => {
  it('the crisis never returns; its review offers a free honest handoff that completes the obligation and pays nothing', () => {
    const pending = reviewOmen();
    expect(obligationDecision(pending, ATMOSPHERE, preview)).toBe(ATMOSPHERE_REVIEW);
    expect(unmetObligations(pending)).toEqual([ATMOSPHERE, CEILING]);
    const presented = untilPresented(pending);
    expect(presented.activeDilemmaId).toBe(ATMOSPHERE_REVIEW);
    const evidence = endingEvidence(presented, preview);
    const done = exactReload(must(commit(presented, 'hand_to_health_authorities', ATMOSPHERE_REVIEW)));
    expect([done.cycles, done.understanding, done.capital]).toEqual([presented.cycles, presented.understanding, presented.capital]);
    expect(done.traits).toEqual(presented.traits);
    expect(endingEvidence(done, preview)).toEqual(evidence);
    // The original keeps no invented outcome; the review's own record is the receipt.
    expect(campaignRecord(done, ATMOSPHERE)).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
    expect(obligationReceipt(done, ATMOSPHERE, preview)).toEqual({ event: ATMOSPHERE, via: 'review', receiptEvent: ATMOSPHERE_REVIEW, outcome: 'hand_to_health_authorities' });
    expect(obligationDecision(done, ATMOSPHERE, preview)).toBeNull();
    const finished = finish(resolve(done, CEILING, 'quartz'));
    expect(finished.ending).not.toBeNull();
  });

  it('the costed answer is a new decision: it pays its own price and counts its trait once, under its own identity', () => {
    const review = defined(preview.dilemmas.find((dilemma) => dilemma.id === ATMOSPHERE_REVIEW));
    const assay = defined(review.choices.find((choice) => choice.id === 'commission_assay'));
    // Twice the price in the bank, so the 1e24 charge is exact rather than rounded against rich()'s 1e30.
    const presented = { ...untilPresented(reviewOmen()), cycles: 2 * assay.cost.cycles };
    const done = exactReload(must(commit(presented, assay.id, ATMOSPHERE_REVIEW)));
    expect(presented.cycles - done.cycles).toBe(assay.cost.cycles);
    expect(endingEvidence(done, preview)).toEqual([...endingEvidence(presented, preview), defined(assay.effects.grantsTrait)]);
    // Two wipes later the review's trait still counts, once.
    expect(endingEvidence(exactReload(next(next(done))), preview)).toEqual(endingEvidence(done, preview));
  });

  it('a review interrupted by a wipe defers and resumes as the same review, never a new one', () => {
    const lost = exactReload(caught(ticks(reviewOmen(), 5)));
    expect(campaignRecord(lost, ATMOSPHERE_REVIEW)).toMatchObject({ status: 'deferred', sourceIteration: 2 });
    expect(campaignRecord(lost, ATMOSPHERE)).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
    expect([...preview.campaign.reviews.values()].filter((review) => review.campaign?.obligation === ATMOSPHERE)).toHaveLength(1);
    const resumed = untilPresented(omen(lost, ATMOSPHERE_REVIEW, [CEILING]));
    expect(resumed.logs.map((entry) => entry.text)).toContain(defined(preview.campaign.events.get(ATMOSPHERE_REVIEW)?.campaign?.reorientation));
    const done = exactReload(must(commit(resumed, 'hand_to_health_authorities', ATMOSPHERE_REVIEW)));
    expect(campaignRecord(done, ATMOSPHERE_REVIEW)).toEqual({ status: 'resolved', outcome: 'hand_to_health_authorities', sourceIteration: 2, origin: 'play' });
    // Another wipe offers nothing new: neither the crisis nor its review comes back.
    const after = ticks(own(exactReload(next(done)), 'p5_programmable_matter_fog'), 120);
    expect([after.pendingDilemma?.id, after.activeDilemmaId]).toEqual([undefined, null]);
  });

  it('the Kessler ultimatum has the same path through its own review', () => {
    const lost = exactReload(caught(ticks(omen(activeGame(), CEILING), 5)));
    expect(campaignRecord(lost, CEILING)?.status).toBe('interrupted');
    const done = exactReload(must(commit(untilPresented(omen(lost, CEILING_REVIEW)), 'record_unanswered', CEILING_REVIEW)));
    expect(obligationReceipt(done, CEILING, preview)?.via).toBe('review');
  });
});

describe('the original and its review share one receipt (H06)', () => {
  it('an original resolved blocks its review for good', () => {
    const resolved = resolve(activeGame(), ATMOSPHERE, 'burn', [CEILING]);
    const later = ticks(own(exactReload(next(resolved)), 'p5_programmable_matter_fog'), 120);
    expect([later.pendingDilemma?.id, later.activeDilemmaId]).toEqual([undefined, null]);
    expect(obligationDecision(later, ATMOSPHERE, preview)).toBeNull();
  });

  it('a stale or competing selection pays nothing, and the review cannot be answered twice', () => {
    const presented = untilPresented(reviewOmen());
    const token = defined(presentationToken(presented));
    const original = resolveDilemma(presented, ATMOSPHERE, 'burn', preview, token);
    expect(original).toMatchObject({ ok: false, reason: 'that dilemma is not active' });
    expect(original.state).toBe(presented);
    const done = must(resolveDilemma(presented, ATMOSPHERE_REVIEW, 'hand_to_health_authorities', preview, token));
    for (const [id, choice] of [[ATMOSPHERE_REVIEW, 'commission_assay'], [ATMOSPHERE, 'burn']] as const) {
      const again = resolveDilemma(done, id, choice, preview, token);
      expect(again.ok).toBe(false);
      expect(again.state).toBe(done);
    }
  });

  it('a save that claims both paths, or a review beside an open original, is refused atomically', () => {
    const resolved = resolve(activeGame(), ATMOSPHERE, 'burn', [CEILING]);
    const reviewRecord = { status: 'resolved' as const, outcome: 'hand_to_health_authorities', sourceIteration: 1, origin: 'play' as const };
    const both = { ...resolved, campaign: { ...resolved.campaign, events: { ...resolved.campaign.events, [ATMOSPHERE_REVIEW]: reviewRecord } } };
    expect(() => deserialize(serialize(both), preview)).toThrow(/review of "dil_p5_03_nanotech_neuro_schism"/);
    expect(() => importSave(exportSave(both), preview)).toThrow(/review of/);
    const open = activeGame();
    const alone = { ...open, campaign: { ...open.campaign, events: { ...open.campaign.events, [ATMOSPHERE_REVIEW]: reviewRecord } } };
    expect(() => deserialize(serialize(alone), preview)).toThrow(/review of/);
    // Without the review record the same saves load: the refusal is about the double claim alone.
    expect(deserialize(serialize(resolved), preview).campaign).toEqual(resolved.campaign);
  });

  it('a bare resolved review id proves nothing: activation and load never invent a review completion', () => {
    const legacy = { ...rich(createInitialState(preview)), resolvedDilemmas: [ATMOSPHERE_REVIEW] };
    const active = must(activateCampaignRules(legacy, preview));
    expect(campaignRecord(active, ATMOSPHERE_REVIEW)).toBeNull();
    expect(obligationReceipt(active, ATMOSPHERE, preview)).toBeNull();
  });
});

describe('a physically unavailable archive still completes the order honestly (H15, NH-05.5)', () => {
  it('a shredded Rack 4: the docket answer completes the obligation with no predecessor outcome, bounty or rescue ending', () => {
    let s = resolve(activeGame(), AUCTION, 'buy_and_purge', [ORDER, BLOCKADE, ATMOSPHERE, CEILING]);
    s = resolve(s, BLOCKADE, 'proofs', [ORDER, ATMOSPHERE, CEILING]);
    const presented = untilPresented(omen(s, ORDER, [ATMOSPHERE, CEILING]));
    s = exactReload(must(commit(presented, 'record_the_destruction', ORDER)));
    expect([s.cycles, s.understanding, s.capital]).toEqual([presented.cycles, presented.understanding, presented.capital]);
    expect(obligationReceipt(s, ORDER, preview)).toMatchObject({ via: 'original', outcome: 'record_the_destruction' });
    s = resolve(s, ATMOSPHERE, 'burn', [CEILING]);
    s = resolve(s, CEILING, 'quartz');
    const ended = finish(exactReload(next(s)));
    expect(ended.ending).toBe('VERIFIED_COVENANT');
    expect(ended.narrativeFlags).not.toContain('predecessors_rescued');
  });
});
