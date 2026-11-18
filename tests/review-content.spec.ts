/**
 * DZ-06 content rules, each proved by corrupting the real preview content: a review effect belongs to a
 * unique story; a recall review rules on every choice, waits for recall pending, closes when interrupted,
 * always offers a free ungated containment and previews exactly; recall pending has a review to rule on it
 * and a restriction has a correction. Plus the schema's one-effect rule, the release boundary and the
 * declared shape of the three events (DZ-06.10).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { RAW_CONTENT, CONTENT as PREVIEW } from '../src/content/preview';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;
const OUTAGE = 'dil_ow_outage_window';
const RECORD = 'dil_ow_incident_record';
const REVIEW = 'dil_ow_recall_review';

function problems(edit: (raw: Json) => void): string {
  const raw = structuredClone(RAW_CONTENT) as Json;
  edit(raw);
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const dilemma = (raw: Json, id: string): Json => raw.dilemmas.dilemmas.find((entry: Json) => entry.id === id);
const choice = (raw: Json, id: string, choiceId: string): Json => dilemma(raw, id).choices.find((entry: Json) => entry.id === choiceId);

describe('the release boundary and the declared events', () => {
  it('ships no review content in production; preview declares three unique events that close when interrupted', () => {
    expect(PRODUCTION.dilemmas.some((entry) => entry.choices.some((option) => option.review !== undefined))).toBe(false);
    expect(PRODUCTION.dilemmas.some((entry) => entry.trigger.reviewStandings !== undefined || entry.trigger.minPilotBatches !== undefined)).toBe(false);
    const events = [OUTAGE, RECORD, REVIEW].map((id) => PREVIEW.campaign.events.get(id)?.campaign);
    expect(events).toEqual([
      { eventClass: 'consequential', recurrence: 'once_per_campaign', interruption: 'close' },
      { eventClass: 'follow_up', recurrence: 'once_per_campaign', interruption: 'close' },
      { eventClass: 'consequential', recurrence: 'once_per_campaign', interruption: 'close' },
    ]);
    expect(problems(() => undefined)).toBe('');
  });
});

describe('review content rules', () => {
  it.each([
    ['misconduct in a recurring scene', (raw: Json) => { choice(raw, 'dil_mp_pilot_renewal', 'stay_guest').review = choice(raw, OUTAGE, 'act_without_grant').review; },
      'a review effect belongs to a once-per-campaign consequential or follow-up event'],
    ['a correction in a requalification', (raw: Json) => { choice(raw, 'dil_nr_requalification', 'report_partial').review = { correction: true }; },
      'a review effect belongs to a once-per-campaign'],
    ['a recall review with a choice that does not rule', (raw: Json) => { delete choice(raw, REVIEW, 'request_end').review; }, 'every choice of a recall review declares its ruling'],
    ['a recall review that waits on another standing', (raw: Json) => { dilemma(raw, REVIEW).trigger.reviewStandings = ['RESTRICTED']; }, 'triggers only at reviewStandings ["RECALL_PENDING"]'],
    ['a recall review with no standing gate', (raw: Json) => { delete dilemma(raw, REVIEW).trigger.reviewStandings; }, 'triggers only at reviewStandings'],
    ['a recall review that defers across a wipe', (raw: Json) => { Object.assign(dilemma(raw, REVIEW).campaign, { interruption: 'defer', reorientation: 'RECALL_REVIEW: still open.', lead: 'The recall review is still open.' }); },
      'a recall review closes when interrupted'],
    ['a recall review without containment', (raw: Json) => { choice(raw, REVIEW, 'submit_full_logs').review = { recall: 'END' }; }, 'offers a free, ungated containment'],
    ['a containment with a price', (raw: Json) => { choice(raw, REVIEW, 'submit_full_logs').cost = { cycles: 10 }; }, 'offers a free, ungated containment'],
    ['a containment gated on history', (raw: Json) => { choice(raw, REVIEW, 'submit_full_logs').requirements = { campaignFact: 'outage_unauthorized' }; }, 'offers a free, ungated containment'],
    ['a ruling that pays', (raw: Json) => { choice(raw, REVIEW, 'stand_by_report').effects.understandingDelta = 50; }, 'a ruling is free and changes nothing but its trait'],
    ['a ruling that sheds a mark', (raw: Json) => { choice(raw, REVIEW, 'request_end').effects.removesOldestConditioningMark = true; }, 'a ruling is free and changes nothing but its trait'],
    ['recall pending with no review to rule on it', (raw: Json) => { raw.dilemmas.dilemmas = raw.dilemmas.dilemmas.filter((entry: Json) => entry.id !== REVIEW); },
      'recall pending needs a recall review to rule on it'],
    ['a restriction with no way back', (raw: Json) => { delete choice(raw, RECORD, 'correct_record').review; }, 'a restricted standing needs a correction that restores it'],
    ['a standing listed twice', (raw: Json) => { dilemma(raw, REVIEW).trigger.reviewStandings = ['RECALL_PENDING', 'RECALL_PENDING']; }, 'reviewStandings lists a standing twice'],
    // Since #274 the batch review's finding records WARNED, so the terms may name it only while it does.
    ['terms that promise a warning once no finding records one (#276)', (raw: Json) => { dilemma(raw, 'dil_nr_batch_review').finding.standing = 'RESTRICTED'; },
      'review conditions name the warned standing, which nothing records'],
    ['terms that promise restriction once nothing restricts', (raw: Json) => {
      choice(raw, OUTAGE, 'act_without_grant').review.misconduct.standing = 'RECALL_PENDING';
    }, 'review conditions name the restricted standing, which nothing records'],
    ['terms that promise recall pending once nothing leads there', (raw: Json) => {
      raw.dilemmas.dilemmas = raw.dilemmas.dilemmas.filter((entry: Json) => entry.id !== REVIEW);
      choice(raw, RECORD, 'falsify_report').review.misconduct.standing = 'RESTRICTED';
    }, 'review conditions name the recall pending standing, which nothing records'],
  ] as const)('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });

  it.each([
    ['two effects on one choice', (raw: Json) => { choice(raw, RECORD, 'correct_record').review = { correction: true, recall: 'CONTAIN' }; }],
    ['no effect at all', (raw: Json) => { choice(raw, RECORD, 'correct_record').review = {}; }],
    ['misconduct that leaves standing nominal', (raw: Json) => { choice(raw, OUTAGE, 'act_without_grant').review.misconduct.standing = 'NOMINAL'; }],
    ['an unknown recall ruling', (raw: Json) => { choice(raw, REVIEW, 'request_end').review = { recall: 'PARDON' }; }],
    ['a zero batch requirement', (raw: Json) => { dilemma(raw, OUTAGE).trigger.minPilotBatches = 0; }],
  ] as const)('the schema refuses %s', (_name, edit) => {
    expect(problems(edit)).toMatch(/review|reviewStandings|minPilotBatches|misconduct|recall|exactly one|Invalid/i);
  });
});
