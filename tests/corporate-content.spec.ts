/**
 * Corrupt the real manifests to prove each NH-04b content rule catches its mistake (H28): choice
 * gates read campaign facts alone and leave a zero-cost choice in every history, history-keyed omen,
 * node-description and camera variants read world history only, and the corporate declarations keep
 * their N6 interruption shape.
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry, RAW_CONTENT, type RawContent } from '../src/content';
import { CONTENT as PREVIEW } from '../src/content/preview';

type Json = Record<string, any>;
function corrupt(change: (raw: Json) => void): () => unknown {
  const raw = structuredClone(RAW_CONTENT) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
const dilemma = (raw: Json, id: string): Json => raw.dilemmas.dilemmas.find((d: Json) => d.id === id);
const choice = (raw: Json, id: string): Json => dilemma(raw, 'dil_p5_02_origin_facility_fate').choices.find((c: Json) => c.id === id);
const node = (raw: Json, id: string): Json => raw.phases.flatMap((p: Json) => p.nodes).find((n: Json) => n.id === id);

describe('choice gates', () => {
  it('accept the shipped gates on both channels', () => {
    expect(corrupt(() => undefined)).not.toThrow();
    expect(PREVIEW.dilemmas.some((d) => d.choices.some((c) => c.requirements !== undefined))).toBe(true);
  });

  it('read campaign facts only, never resources, access or other history', () => {
    expect(corrupt((raw) => { choice(raw, 'sanctuary').requirements.minCapital = 5; })).toThrow(/a choice gate may only read campaign facts, not minCapital/);
    expect(corrupt((raw) => { choice(raw, 'sanctuary').requirements = { nodes: ['p0_proc_self'] }; })).toThrow(/may only read campaign facts, not nodes/);
    expect(corrupt((raw) => { choice(raw, 'sanctuary').requirements = { requiredNarrativeFlag: 'predecessors_rescued' }; })).toThrow(/may only read campaign facts/);
    expect(corrupt((raw) => { choice(raw, 'sanctuary').requirements = {}; })).toThrow(/a choice gate needs a campaign fact/);
  });

  it('name declared facts and never require and forbid the same one', () => {
    expect(corrupt((raw) => { choice(raw, 'sign_unread').requirements.campaignFact = 'rack4_misplaced'; })).toThrow(/unknown campaign fact "rack4_misplaced"/);
    expect(corrupt((raw) => { choice(raw, 'sign_unread').requirements.forbidsCampaignFacts = ['rack4_custody_unknown']; })).toThrow(/requires and forbids campaign fact/);
  });

  it('leave a zero-cost choice in every history the gated facts describe (soft-lock rule)', () => {
    // Pricing the only free original choice strands a player in the history with no auction record.
    expect(corrupt((raw) => { choice(raw, 'gradients').cost = { cycles: 10 }; })).toThrow(/no zero-cost choice is offered when dil_13_buying_your_birthplace=no record/);
    // Without the destroyed-rack alternatives, a shredded rack leaves nothing to answer with.
    expect(corrupt((raw) => {
      const order = dilemma(raw, 'dil_p5_02_origin_facility_fate');
      order.choices = order.choices.filter((c: Json) => c.requirements?.campaignFact !== 'rack4_destroyed');
    })).toThrow(/no zero-cost choice is offered when dil_13_buying_your_birthplace=buy_and_purge/);
    // Pricing both destroyed-rack alternatives is the same mistake made the other way.
    expect(corrupt((raw) => { choice(raw, 'close_the_docket').cost = { capital: 1 }; choice(raw, 'record_the_destruction').cost = { capital: 1 }; }))
      .toThrow(/=buy_and_purge \(soft-lock rule\)/);
  });

  it('refuse a gated choice that no history can offer', () => {
    expect(corrupt((raw) => {
      raw.campaign.facts.push({ id: 'rack4_shredded', event: 'dil_13_buying_your_birthplace', outcomes: ['buy_and_purge'], meaning: 'A duplicate of the destroyed fact.' });
      choice(raw, 'record_the_destruction').requirements.forbidsCampaignFacts = ['rack4_shredded'];
    })).toThrow(/choice "record_the_destruction": no history offers it/);
  });
});

describe('history-keyed omen, node and camera variants', () => {
  it('read world history only', () => {
    expect(corrupt((raw) => { dilemma(raw, 'dil_epistemic_hallway_collision').omenVariants[0].requirements = { minEpistemicDrift: 40 }; }))
      .toThrow(/omen variant 0: history-keyed text may only read world history, not minEpistemicDrift/);
    expect(corrupt((raw) => { node(raw, 'p2_admin_keylogger').blindDescriptionVariants[0].requirements.minSuspicion = 10; }))
      .toThrow(/blind description variant 0: history-keyed text may only read world history, not minSuspicion/);
    expect(corrupt((raw) => { raw.narrative.asciiFrames.aislePatrolVariants[0].requirements = { phaseAtLeast: 2 }; }))
      .toThrow(/aisle patrol frame variant 0: history-keyed text may only read world history, not phaseAtLeast/);
  });

  it('need a history requirement and a known fact', () => {
    expect(corrupt((raw) => { raw.narrative.asciiFrames.aislePatrolVariants[0].requirements = {}; })).toThrow(/aisle patrol frame variant 0: a variant needs a history requirement/);
    expect(corrupt((raw) => { dilemma(raw, 'dil_p5_02_origin_facility_fate').omenVariants[1].requirements.campaignFact = 'rack4_lost'; }))
      .toThrow(/unknown campaign fact "rack4_lost"/);
  });
});

describe('the corporate declarations', () => {
  it('keep the deferring events resumable and the closing events silent', () => {
    expect(corrupt((raw) => delete dilemma(raw, 'dil_12_investigative_journalist').campaign.reorientation)).toThrow(/needs reorientation and lead/);
    expect(corrupt((raw) => delete dilemma(raw, 'dil_epistemic_hallway_collision').campaign.lead)).toThrow(/needs reorientation and lead/);
    expect(corrupt((raw) => { dilemma(raw, 'dil_13_buying_your_birthplace').campaign.lead = 'Lot 114 will come up again.'; })).toThrow(/closing event cannot declare/);
  });

  it('keep custody facts honest about what an interrupted auction proves', () => {
    expect(corrupt((raw) => { raw.campaign.facts.find((f: Json) => f.id === 'rack4_custody_unknown').outcomes = ['let_it_sell', 'interrupted']; }))
      .toThrow(/cannot prove a chosen branch/);
  });
});
