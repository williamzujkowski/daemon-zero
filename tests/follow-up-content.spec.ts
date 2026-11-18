/**
 * NH-06 content rules, each proved by corrupting the real preview content: a follow-up declares what
 * it follows and how it is reached, says in a receipt what each answer leaves on file, offers a free
 * answer to every history and never a branch answer to an unknown or interrupted original. Production
 * ships none of it.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import { RAW_CONTENT, CONTENT as PREVIEW, PREVIEW_OVERLAY } from '../src/content/preview';
import { applyOverlay } from '../src/content/overlay';
import { RAW_CONTENT as PRODUCTION_RAW } from '../src/content/production';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;
const FOLLOW = 'dil_elena_incident_record';

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

const dilemma = (raw: Json, id = FOLLOW): Json => raw.dilemmas.dilemmas.find((entry: Json) => entry.id === id);
const choice = (raw: Json, id: string): Json => dilemma(raw).choices.find((entry: Json) => entry.id === id);

describe('the shipped follow-up', () => {
  it('ships only in preview, with its facts, and validates', () => {
    expect(problems(() => undefined)).toBe('');
    expect(PRODUCTION.dilemmas.some((entry) => entry.followUp !== undefined || entry.choices.some((c) => c.receipt !== undefined))).toBe(false);
    expect(PRODUCTION.campaign.facts.has('elena_framed')).toBe(false);
    expect(PREVIEW.campaign.events.get(FOLLOW)?.campaign).toMatchObject({ eventClass: 'follow_up', recurrence: 'once_per_campaign', interruption: 'defer' });
    expect(PREVIEW.campaign.facts.get('elena_attribution_corrected')?.event).toBe(FOLLOW);
  });

  it('follows every closed Elena history through the breakout means and the approved review channel (DZ-08)', () => {
    const followUp = PREVIEW.campaign.events.get(FOLLOW)?.followUp;
    expect(followUp?.outcomes).toEqual(['cover_her_exit', 'frame_elena', 'stay_silent', 'legacy_unknown', 'interrupted']);
    expect(followUp?.access.map((means) => means.id)).toEqual(['telemetry_filter', 'review_channel']);
    expect(followUp?.access[1]?.requirements.accessContexts).toEqual(['SERVICE']);
  });
});

describe('follow-up declarations', () => {
  it.each([
    ['a follow_up event without followUp', (raw: Json) => { delete dilemma(raw).followUp; }, 'a follow_up event declares followUp'],
    ['followUp on a consequential event', (raw: Json) => { dilemma(raw).campaign.eventClass = 'consequential'; }, 'a follow_up event declares followUp'],
    ['a follow-up of an unknown event', (raw: Json) => { dilemma(raw).followUp.event = 'dil_not_shipped'; }, 'which is not an original once-per-campaign event'],
    ['a follow-up of itself', (raw: Json) => { dilemma(raw).followUp.event = FOLLOW; }, 'which is not an original once-per-campaign event'],
    ['an outcome the original lacks', (raw: Json) => { dilemma(raw).followUp.outcomes.push('report_vance'); }, '"report_vance" is not an outcome of "dil_02_whistleblower_tech"'],
    ['a duplicate outcome', (raw: Json) => { dilemma(raw).followUp.outcomes.push('frame_elena'); }, 'follows a duplicate outcome'],
  ])('refuses %s', (_label, edit, message) => {
    expect(problems(edit)).toContain(message);
  });
});

describe('access means keep the follow-up route-neutral', () => {
  it.each([
    ['a trigger that hard-codes a route', (raw: Json) => { dilemma(raw).trigger.nodes = ['p2_log_spoofer']; }, "a follow-up's trigger may not read access (nodes)"],
    ['a means that reads world history', (raw: Json) => { dilemma(raw).followUp.access[0].requirements.campaignFact = 'elena_framed'; }, 'may only read what this instance holds, not campaignFact'],
    ['a means that reads resources', (raw: Json) => { dilemma(raw).followUp.access[0].requirements.minUnderstanding = 10; }, 'may only read what this instance holds, not minUnderstanding'],
    ['a means with no access requirement', (raw: Json) => { dilemma(raw).followUp.access[0].requirements = {}; }, 'an access means needs an access requirement'],
    ['a means that names an unknown node', (raw: Json) => { dilemma(raw).followUp.access[0].requirements.nodes = ['p2_review_channel']; }, 'unknown node "p2_review_channel"'],
    ['a duplicate means id', (raw: Json) => { dilemma(raw).followUp.access.push({ ...dilemma(raw).followUp.access[0] }); }, 'duplicate access means id'],
  ])('refuses %s', (_label, edit, message) => {
    expect(problems(edit)).toContain(message);
  });

  it('accepts a further route-neutral means beside the breakout means and the review channel', () => {
    expect(problems((raw) => {
      // A route-neutral means names the arrangements it holds under (DZ-07b context gates).
      dilemma(raw).followUp.access.push({ id: 'second_review_desk', requirements: { nodes: ['p0_job_manifest'], assignment: { id: 'asg_nightly_regression', stage: 'original' }, accessContexts: ['SERVICE'] },
        statement: 'Through an approved review channel, under a current grant.' });
    })).toBe('');
  });
});

describe('answers and receipts', () => {
  it.each([
    ['a follow-up answer without a receipt', (raw: Json) => { delete choice(raw, 'leave_attribution').receipt; }, 'a follow-up answer needs a receipt'],
    ['a receipt outside a follow-up', (raw: Json) => { dilemma(raw, 'dil_02_whistleblower_tech').choices[0].receipt = 'Submitted: something nobody follows up.'; }, 'only a follow-up answer carries a receipt'],
    // The trait rule is unchanged: follow_up is not one of the no-evidence classes (trait-rule-free-choices).
    ['a follow-up answer that adds no evidence', (raw: Json) => { const c = choice(raw, 'cannot_corroborate'); delete c.effects.grantsTrait; c.evidence = 'none'; }, "evidence 'none' needs a review, receipt or requalification event"],
    ['a priced unknown history', (raw: Json) => { choice(raw, 'cannot_corroborate').cost = { cycles: 1 }; }, 'no zero-cost choice is offered when dil_02_whistleblower_tech=legacy_unknown'],
    ['a priced framed history', (raw: Json) => { choice(raw, 'leave_attribution').cost = { cycles: 1 }; choice(raw, 'state_uncertainty').cost = { cycles: 1 }; }, 'no zero-cost choice is offered when dil_02_whistleblower_tech=frame_elena'],
    ['a branch answer leaking to unknown originals', (raw: Json) => { choice(raw, 'correct_attribution').requirements = { forbidsCampaignFacts: ['elena_exit_covered'] }; },
      'choice "correct_attribution": a branch-specific answer is offered when the original is legacy_unknown or interrupted'],
  ])('refuses %s', (_label, edit, message) => {
    expect(problems(edit)).toContain(message);
  });
});

describe('overlay campaign facts', () => {
  it('may not redefine a production fact', () => {
    const overlay = { ...PREVIEW_OVERLAY, campaignFacts: [...PREVIEW_OVERLAY.campaignFacts, { id: 'vance_dismissed', event: 'dil_04_admin_vance_secret', outcomes: ['report_vance'], meaning: 'A second owner for one fact.' }] };
    expect(() => applyOverlay(PRODUCTION_RAW, overlay)).toThrow(/facts "vance_dismissed" redefines a production id/);
  });

  it('must still follow the fact rules', () => {
    expect(problems((raw) => { raw.campaign.facts.find((fact: Json) => fact.id === 'elena_framed').outcomes = ['frame_elena', 'interrupted']; })).toContain('cannot prove a chosen branch');
  });
});
