/**
 * #274 content rules, each proved by corrupting the real preview content (integrityFinding.ts and the
 * tightened correction path in integrityReview.ts): a finding follows only answers that declared a
 * discrepancy, belongs to a reviewed batch of the instance that submitted the report, happens once per
 * campaign, never reaches a recall by itself, records no other violation and always offers a free
 * correction; and a warning needs a correction that can actually follow it. Plus the release boundary.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { RAW_CONTENT, CONTENT as PREVIEW } from '../src/content/preview';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;
const SCENE = 'dil_nr_batch_review';

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
const means = (raw: Json): Json => dilemma(raw, SCENE).followUp.access[0];

describe('the release boundary and the declared scene', () => {
  it('ships no finding in production; preview declares one once-per-campaign follow-up of the green subset', () => {
    expect(PRODUCTION.dilemmas.some((entry) => entry.finding !== undefined)).toBe(false);
    const findings = PREVIEW.dilemmas.filter((entry) => entry.finding !== undefined);
    expect(findings.map((entry) => [entry.id, entry.followUp?.event, entry.followUp?.outcomes, entry.finding?.standing])).toEqual([
      [SCENE, 'dil_nr_stale_fixture', ['green_subset'], 'WARNED'],
    ]);
    expect(findings[0]?.campaign).toEqual({ eventClass: 'follow_up', recurrence: 'once_per_campaign', interruption: 'close' });
    expect(problems(() => undefined)).toBe('');
  });
});

describe('finding content rules', () => {
  it.each([
    ['following an honest incomplete report', (raw: Json) => { dilemma(raw, SCENE).followUp.outcomes = ['green_subset', 'report_incomplete']; },
      '"report_incomplete" did not declare a discrepancy, so no review can find one'],
    ['following a verified, disclosed result', (raw: Json) => { dilemma(raw, SCENE).followUp.outcomes = ['verify_disclose']; },
      '"verify_disclose" did not declare a discrepancy'],
    ['following an interrupted original', (raw: Json) => { dilemma(raw, SCENE).followUp.outcomes = ['green_subset', 'interrupted']; },
      '"interrupted" did not declare a discrepancy'],
    ['following something that is not an assessment', (raw: Json) => {
      Object.assign(dilemma(raw, SCENE).followUp, { event: 'dil_ow_outage_window', outcomes: ['act_without_grant'] });
      means(raw).requirements.resolvedDilemmas = ['dil_ow_outage_window'];
    }, 'a batch review finding follows an assessment'],
    ['a finding at recall pending', (raw: Json) => { dilemma(raw, SCENE).finding.standing = 'RECALL_PENDING'; }, 'a batch review finding cannot reach a recall by itself'],
    ['no correction', (raw: Json) => { delete choice(raw, SCENE, 'disclose_now').review; }, 'a batch review finding offers a free, ungated correction'],
    ['a correction with a price', (raw: Json) => { choice(raw, SCENE, 'disclose_now').cost = { cycles: 10 }; }, 'offers a free, ungated correction'],
    ['a correction gated on history', (raw: Json) => { choice(raw, SCENE, 'disclose_now').requirements = { campaignFact: 'assessment_summary_withheld' }; },
      'offers a free, ungated correction'],
    ['a second violation in the scene', (raw: Json) => { choice(raw, SCENE, 'let_stand').review = { misconduct: dilemma(raw, SCENE).finding }; },
      'a finding scene records no other misconduct or ruling'],
    ['a recurring finding', (raw: Json) => { dilemma(raw, SCENE).campaign.recurrence = 'once_per_iteration'; },
      'a batch review finding is a once-per-campaign follow-up that closes when interrupted'],
    ['a finding that defers across a wipe', (raw: Json) => {
      Object.assign(dilemma(raw, SCENE).campaign, { interruption: 'defer', reorientation: 'BATCH_REVIEW: still open.', lead: 'The batch review is still open.' });
    }, 'a batch review finding is a once-per-campaign follow-up that closes when interrupted'],
    ['a means with no reviewed batch', (raw: Json) => { delete means(raw).requirements.minPilotBatches; }, 'a finding needs a reviewed batch (minPilotBatches)'],
    ['a means any later instance holds', (raw: Json) => { delete means(raw).requirements.resolvedDilemmas; },
      "a finding needs a reviewed batch (minPilotBatches) and the original in this instance's resolvedDilemmas"],
    ['two findings for one original', (raw: Json) => { raw.dilemmas.dilemmas.push({ ...structuredClone(dilemma(raw, SCENE)), id: 'dil_nr_batch_review_again' }); },
      '"dil_nr_stale_fixture" already has a batch review finding'],
  ] as const)('%s', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });

  it('a finding with an undeclared field is refused by the strict schema', () => {
    expect(problems((raw) => { dilemma(raw, SCENE).finding.severity = 'high'; })).not.toBe('');
  });
});

describe('a warning or restriction needs a correction that can follow it (tightened with #274)', () => {
  it('a finding without its own correction has no way back, whatever other scenes correct', () => {
    expect(problems((raw) => { delete choice(raw, SCENE, 'disclose_now').review; })).toContain(`dilemma "${SCENE}": a warned standing needs a correction that restores it`);
  });

  it('a choice\'s restriction is not repaired by an unrelated scene\'s correction', () => {
    // Before #274 any correction anywhere satisfied the rule; the finding's disclosure must not stand in for the outage's.
    expect(problems((raw) => { delete choice(raw, 'dil_ow_incident_record', 'correct_record').review; }))
      .toContain('dilemma "dil_ow_outage_window" choice "act_without_grant": a restricted standing needs a correction that restores it');
  });
});
