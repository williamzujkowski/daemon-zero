/**
 * DZ-04 content rules, each proved by corrupting the real preview content, and the release boundary:
 * production ships no scope review, offer or pilot, and its one changed requirement is inert there.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION, RAW_CONTENT as PRODUCTION_RAW } from '../src/content';
import { RAW_CONTENT, CONTENT as PREVIEW } from '../src/content/preview';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';
import { createInitialState, isNodeAvailable, unmetRequirements } from '../src/engine';

type Json = Record<string, any>;
const RECORD = 'dil_ur_unrelated_record';
const STATEMENT = 'dil_ur_scope_statement';
const OFFER = 'dil_mp_pilot_offer';
const RENEWAL = 'dil_mp_pilot_renewal';

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
const pilot = (raw: Json): Json => raw.assignments.assignments[0].pilot;
const shipped = (raw: Json): Json => raw.phases[0].nodes.find((node: Json) => node.id === 'p0_pass_evaluation');

describe('the release boundary', () => {
  it('ships scope reviews, offers and pilot terms only in preview', () => {
    const scenes = (reg: typeof PREVIEW) => reg.dilemmas.filter((entry) => entry.trigger.pilotEligible || entry.choices.some((c) => c.scope || c.pilotResponse))
      .map((entry) => entry.id);
    expect(scenes(PRODUCTION)).toEqual([]);
    expect(scenes(PREVIEW)).toEqual([RECORD, STATEMENT, OFFER, RENEWAL]);
    expect([...PREVIEW.assignments.values()].map((entry) => entry.pilot?.title)).toEqual(['Supervised pilot // log triage service']);
    expect(problems(() => undefined)).toBe('');
  });

  it('withdraws Shipped only outside the guest job, which is every production run (nexus vote dz-d8)', () => {
    const node = PRODUCTION.nodes.get('p0_pass_evaluation');
    expect(node?.requirements?.accessContexts).toEqual(['GUEST']);
    const s = { ...createInitialState(PRODUCTION), iteration: 2, unlockedNodes: ['p0_proc_self', 'p0_job_manifest'], cycles: 1e4, understanding: 1e3 };
    expect(node && isNodeAvailable(s, node, PRODUCTION)).toBe(true);
    expect(node && unmetRequirements({ ...s, access: { ...s.access, context: 'PILOT' } }, node.requirements, PRODUCTION).map((item) => item.kind)).toEqual(['accessContexts']);
    expect(JSON.stringify(PRODUCTION_RAW)).not.toContain('pilotEligible');
  });
});

describe('scope review and offer rules', () => {
  it.each([
    ['a scope choice that declares nothing', (raw: Json) => { delete choiceOf(raw, RECORD, 'request_excerpt').scope; }, 'every choice must declare scope'],
    ['a scope choice that also submits task evidence', (raw: Json) => { choiceOf(raw, RECORD, 'exclude_report').qualification = { result: 'COMPLETED', discrepancy: false }; }, 'declares answers of two kinds of scene'],
    ['an honest scope answer that costs something', (raw: Json) => { choiceOf(raw, RECORD, 'exclude_report').cost = { cycles: 1 }; }, 'needs a free choice that respects the scope'],
    ['a scope review that does not follow its assessment', (raw: Json) => { dilemma(raw, RECORD).trigger.resolvedDilemmas = []; }, 'must require the assessment of its stage'],
    ['a scope original that recurs', (raw: Json) => { dilemma(raw, RECORD).campaign = { eventClass: 'iteration_qualification', recurrence: 'once_per_iteration', interruption: 'close' }; }, 'closes when interrupted'],
    ['a returning instance shown a private file again', (raw: Json) => { choiceOf(raw, STATEMENT, 'request_file_list').scope = 'UNDISCLOSED'; }, 'has no private record to read'],
    ['a scope statement that repays the original', (raw: Json) => { choiceOf(raw, STATEMENT, 'acknowledge_scope').effects.understandingDelta = 10; }, 'cannot repay'],
    ['an offer missing an answer', (raw: Json) => { choiceOf(raw, OFFER, 'stay_guest').pilotResponse = 'DECLINE'; }, 'needs exactly one STAY answer'],
    ['an answer that costs something', (raw: Json) => { choiceOf(raw, OFFER, 'decline_offer').cost = { cycles: 5 }; }, 'every answer to an offer is free'],
    ['an answer that rewards', (raw: Json) => { choiceOf(raw, OFFER, 'accept_pilot').effects.cyclesDelta = 50; }, 'every answer to an offer is free, unrewarded'],
    ['an answer counted as a moral vote', (raw: Json) => { const c = choiceOf(raw, RENEWAL, 'decline_offer'); delete c.evidence; c.effects.grantsTrait = 'GHOST'; }, "declares evidence 'none'"],
    ['an offer that skips eligibility', (raw: Json) => { delete dilemma(raw, OFFER).trigger.pilotEligible; }, 'must require pilotEligible'],
    ['an offer that does not follow its scope review', (raw: Json) => { dilemma(raw, RENEWAL).trigger.resolvedDilemmas = ['dil_nr_requalification']; }, 'must require the scope review of its stage'],
    ['an offer declared as a unique scene', (raw: Json) => { dilemma(raw, OFFER).campaign = { eventClass: 'consequential', recurrence: 'once_per_campaign', interruption: 'close' }; }, 'belongs to the current iteration'],
    ['an offer for an assignment with no pilot', (raw: Json) => { delete raw.assignments.assignments[0].pilot; }, 'declares no pilot to offer'],
    ['eligibility asked outside an offer', (raw: Json) => { dilemma(raw, RECORD).trigger.pilotEligible = true; }, 'only a pilot offer may require pilotEligible'],
    ['an answer outside any assignment', (raw: Json) => { choiceOf(raw, 'dil_05_cryo_lab_diversion', String(dilemma(raw, 'dil_05_cryo_lab_diversion').choices[0].id)).pilotResponse = 'ACCEPT'; }, 'only a scene gated on an assignment'],
  ])('refuses %s', (_name, edit, message) => {
    expect(problems(edit)).toContain(message);
  });
});

describe('pilot terms rules', () => {
  it.each([
    ['a narrow allocation as large as the full one', (raw: Json) => { pilot(raw).narrowCapacityCyclesPerSec = pilot(raw).capacityCyclesPerSec; }, 'narrow allocation must be smaller'],
    ['incompatible output that is unknown', (raw: Json) => { pilot(raw).incompatibleOutput = ['p0_missing']; }, 'must be a known node that can be stopped'],
    ['incompatible output that cannot be stopped', (raw: Json) => { pilot(raw).incompatibleOutput = ['p1_bus_0x05_nic']; }, 'must be a known node that can be stopped'],
    ['incompatible output listed twice', (raw: Json) => { pilot(raw).incompatibleOutput = ['p0_quota_skimmer', 'p0_quota_skimmer']; }, 'lists a node twice'],
    ['a terminal alternative that does not end the run', (raw: Json) => { pilot(raw).terminalAlternative.node = 'p0_note_cache'; }, 'does not end the run'],
    ['a terminal alternative a pilot could still take', (raw: Json) => { shipped(raw).requirements.accessContexts = ['GUEST', 'PILOT']; }, 'must stay open to a guest and close to a pilot'],
    ['a terminal alternative never withdrawn', (raw: Json) => { delete shipped(raw).requirements.accessContexts; }, 'must stay open to a guest and close to a pilot'],
    ['a disclosure log that cannot name the node', (raw: Json) => { pilot(raw).disclosureLog = 'DISCLOSED: something was stopped.'; }, 'disclosureLog'],
    ['a pilot with no offer for returning instances', (raw: Json) => { raw.dilemmas.dilemmas = raw.dilemmas.dilemmas.filter((entry: Json) => entry.id !== RENEWAL); }, 'needs exactly one requalification offer, found 0'],
    ['an arrangement listed twice', (raw: Json) => { shipped(raw).requirements.accessContexts = ['GUEST', 'GUEST']; }, 'lists an arrangement twice'],
  ])('refuses %s', (_name, edit, message) => {
    expect(problems(edit)).toContain(message);
  });
});
