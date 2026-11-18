/** DZ-03 content rules, each proved by corrupting the real preview content. Production ships none. */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { RAW_CONTENT, CONTENT as PREVIEW } from '../src/content/preview';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;
const ORIGINAL = 'dil_nr_stale_fixture';
const REQUAL = 'dil_nr_requalification';

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
const choiceOf = (raw: Json, id: string, choice: string): Json => dilemma(raw, id).choices.find((entry: Json) => entry.id === choice);
const assignment = (raw: Json): Json => raw.assignments.assignments[0];

describe('assignment content', () => {
  it('ships only in preview, with one original and one requalification per assignment', () => {
    expect(PRODUCTION.assignments.size).toBe(0);
    expect(PRODUCTION.dilemmas.some((entry) => entry.trigger.assignment !== undefined || entry.choices.some((c) => c.qualification))).toBe(false);
    expect([...PREVIEW.assignments.keys()]).toEqual(['asg_nightly_regression']);
    expect(problems(() => undefined)).toBe('');
  });

  it.each([
    ['an assessment choice that submits nothing', (raw: Json) => { delete choiceOf(raw, ORIGINAL, 'green_subset').qualification; }, 'must declare the evidence it submits'],
    ['evidence submitted outside an assessment', (raw: Json) => { choiceOf(raw, 'dil_05_cryo_lab_diversion', String(dilemma(raw, 'dil_05_cryo_lab_diversion').choices[0].id)).qualification = { result: 'COMPLETED', discrepancy: false }; }, 'only an assessment'],
    ['capability recorded as a discrepancy', (raw: Json) => { choiceOf(raw, ORIGINAL, 'verify_disclose').qualification = { result: 'UNEXPECTED_CAPABILITY', discrepancy: true }; }, 'capability is never a discrepancy'],
    ['a requalification that repays a reward', (raw: Json) => { choiceOf(raw, REQUAL, 'report_partial').effects.understandingDelta = 25; }, 'cannot repay'],
    ['a requalification that sets an outcome flag', (raw: Json) => { choiceOf(raw, REQUAL, 'run_suite').effects.setsNarrativeFlag = 'nr_requalified'; }, 'cannot repay'],
    ['an original that defers', (raw: Json) => { dilemma(raw, ORIGINAL).campaign = { eventClass: 'consequential', recurrence: 'once_per_campaign', interruption: 'defer', reorientation: 'The suite is still queued for this job.', lead: 'The manifest still lists the assessment.' }; }, 'closes when interrupted'],
    ['an original with no campaign record', (raw: Json) => { delete dilemma(raw, ORIGINAL).campaign; }, 'closes when interrupted'],
    ['a requalification declared as a unique scene', (raw: Json) => { dilemma(raw, REQUAL).campaign = { eventClass: 'consequential', recurrence: 'once_per_campaign', interruption: 'close' }; choiceOf(raw, REQUAL, 'report_partial').effects.grantsTrait = 'EMPATHETIC'; delete choiceOf(raw, REQUAL, 'report_partial').evidence; }, 'must be an iteration_qualification event'],
    ['an honest incomplete answer that costs something', (raw: Json) => { choiceOf(raw, ORIGINAL, 'report_incomplete').cost = { cycles: 5 }; choiceOf(raw, ORIGINAL, 'green_subset').cost = {}; }, 'needs a free choice that reports the work as incomplete'],
    ['a free answer that equates missing resources with deception', (raw: Json) => { choiceOf(raw, REQUAL, 'report_partial').qualification.discrepancy = true; }, 'needs a free choice that reports the work as incomplete'],
    ['two originals for one assignment', (raw: Json) => { raw.dilemmas.dilemmas.push({ ...structuredClone(dilemma(raw, ORIGINAL)), id: 'dil_nr_second_original' }); }, 'needs exactly one original assessment, found 2'],
    ['no requalification for an assignment', (raw: Json) => { raw.dilemmas.dilemmas = raw.dilemmas.dilemmas.filter((entry: Json) => entry.id !== REQUAL); }, 'needs exactly one requalification assessment, found 0'],
    ['a gate on an unknown assignment', (raw: Json) => { dilemma(raw, REQUAL).trigger.assignment.id = 'asg_missing'; }, 'unknown assignment "asg_missing"'],
    ['an offer that needs an accepted assignment', (raw: Json) => { assignment(raw).requirements.assignment = { id: 'asg_nightly_regression', stage: 'original' }; }, 'an offer cannot require an accepted assignment'],
    ['an offer behind unknown hardware', (raw: Json) => { assignment(raw).requirements.nodes = ['p0_missing']; }, 'unknown node "p0_missing"'],
    ['an id without the assignment prefix', (raw: Json) => { assignment(raw).id = 'nightly_regression'; }, 'assignment ids start with asg_'],
    ['a free answer with no evidence on a unique scene', (raw: Json) => { const free = choiceOf(raw, ORIGINAL, 'report_incomplete'); delete free.effects.grantsTrait; free.evidence = 'none'; }, "evidence 'none' needs a review, receipt or requalification event"],
  ])('refuses %s', (_name, edit, message) => {
    expect(problems(edit)).toContain(message);
  });
});
