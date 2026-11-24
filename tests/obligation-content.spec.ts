/**
 * NH-05 content rules (H28, NH-05.9): corrupt the shipped manifests to prove each obligation, review,
 * inherited-fact and legacy-ambiguity rule catches its mistake, and that the shipped content passes.
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry, CONTENT, RAW_CONTENT, type RawContent } from '../src/content';
import { CONTENT as PREVIEW } from '../src/content';
import { ATMOSPHERE, ATMOSPHERE_REVIEW, BLOCKADE, CEILING, CEILING_REVIEW, OBLIGATIONS, ORDER } from './obligation-helpers';

type Json = Record<string, any>;
function corrupt(change: (raw: Json) => void): () => unknown {
  const raw = structuredClone(RAW_CONTENT) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
const dilemma = (raw: Json, id: string): Json => raw.dilemmas.dilemmas.find((d: Json) => d.id === id);
const finalReq = (raw: Json): Json => raw.phases[5].nodes.at(-1).requirements;
const fact = (raw: Json, id: string): Json => raw.campaign.facts.find((f: Json) => f.id === id);
const ending = (raw: Json, id: string): Json => raw.endings.endings.find((e: Json) => e.id === id);

describe('the shipped obligations', () => {
  it('pass on both channels: four obligations, two reviews, one per closing crisis', () => {
    expect(corrupt(() => undefined)).not.toThrow();
    for (const reg of [CONTENT, PREVIEW]) {
      // The protocol and the Mercury seed array that opens the Swarm both need the four (#486); the swarm's protocols need the holdouts.
      expect([...new Set([...reg.nodes.values()].flatMap((node) => node.requirements?.campaignObligations ?? []))]).toEqual([...OBLIGATIONS, 'dil_p6_02_holdouts']);
      expect(new Map([...reg.campaign.reviews].map(([id, review]) => [id, review.id]))).toEqual(new Map([[ATMOSPHERE, ATMOSPHERE_REVIEW], [CEILING, CEILING_REVIEW]]));
    }
  });
});

describe('an obligation names a consequential campaign event with an attainable path', () => {
  it('rejects an unknown, unconverted or review id, and a duplicate', () => {
    expect(corrupt((raw) => { finalReq(raw).campaignObligations = ['dil_not_shipped']; })).toThrow(/campaign obligation "dil_not_shipped" is not a consequential/);
    expect(corrupt((raw) => { delete dilemma(raw, BLOCKADE).campaign; })).toThrow(/campaign obligation "dil_p5_01_panacea_paranoia" is not a consequential/);
    expect(corrupt((raw) => { finalReq(raw).campaignObligations.push(ATMOSPHERE_REVIEW); })).toThrow(/campaign obligation "dil_p5_03_atmosphere_review" is not a consequential/);
    expect(corrupt((raw) => { finalReq(raw).campaignObligations.push(BLOCKADE); })).toThrow(/duplicate campaign obligation/);
  });

  it('rejects an obligated event whose trigger may never hold again before the purchase', () => {
    expect(corrupt((raw) => { dilemma(raw, BLOCKADE).trigger.minIteration = 3; })).toThrow(/iteration window could close its only path/);
    expect(corrupt((raw) => { dilemma(raw, BLOCKADE).trigger.campaignFact = 'vance_dismissed'; })).toThrow(/reads world history \(campaignFact\)/);
    expect(corrupt((raw) => { dilemma(raw, BLOCKADE).trigger.requiresSurveillance = true; })).toThrow(/access this instance may not regain \(requiresSurveillance\)/);
    expect(corrupt((raw) => { dilemma(raw, CEILING).trigger.nodes = ['p5_transcendence_singularity']; })).toThrow(/is not on the way to "p5_transcendence_singularity"/);
  });

  it('rejects a closing crisis with no recovery review, or with two', () => {
    expect(corrupt((raw) => { raw.dilemmas.dilemmas = raw.dilemmas.dilemmas.filter((d: Json) => d.id !== CEILING_REVIEW); }))
      .toThrow(/obligation "dil_p5_04_kessler_ultimatum": a closed occurrence has no recovery review/);
    expect(corrupt((raw) => { raw.dilemmas.dilemmas.push({ ...structuredClone(dilemma(raw, CEILING_REVIEW)), id: 'dil_p5_04_second_review' }); }))
      .toThrow(/more than one recovery review completes it/);
  });

  it('rejects a once-per-campaign event used as a current-run gate (once is the declared class)', () => {
    expect(corrupt((raw) => { raw.phases[5].nodes.at(-1).requirements = { resolvedDilemmas: OBLIGATIONS }; })).toThrow(/use campaignObligations/);
  });
});

describe('a recovery review completes only a closed original, honestly, once', () => {
  it('needs the obligation it completes, and only a review may declare one', () => {
    expect(corrupt((raw) => { delete dilemma(raw, CEILING_REVIEW).campaign.obligation; })).toThrow(/must name the obligation it completes/);
    expect(corrupt((raw) => { dilemma(raw, CEILING_REVIEW).campaign.obligation = ATMOSPHERE_REVIEW; })).toThrow(/is not a once-per-campaign event/);
    expect(corrupt((raw) => { dilemma(raw, BLOCKADE).campaign.obligation = CEILING; })).toThrow(/only a recovery review completes an obligation/);
  });

  it('triggers only on its original closing unobserved', () => {
    expect(corrupt((raw) => { fact(raw, 'ultimatum_decision_lost').outcomes = ['interrupted', 'legacy_unknown']; })).toThrow(/holds only when "dil_p5_04_kessler_ultimatum" closed unobserved/);
    expect(corrupt((raw) => { delete dilemma(raw, CEILING_REVIEW).trigger.campaignFact; })).toThrow(/holds only when "dil_p5_04_kessler_ultimatum" closed unobserved/);
    expect(corrupt((raw) => { dilemma(raw, CEILING_REVIEW).trigger.campaignFact = 'atmosphere_decision_lost'; })).toThrow(/holds only when "dil_p5_04_kessler_ultimatum" closed unobserved/);
    expect(corrupt((raw) => { dilemma(raw, CEILING_REVIEW).trigger.forbidsCampaignFacts = ['vance_dismissed']; })).toThrow(/reads world history \(forbidsCampaignFacts\)/);
  });

  it('defers, so an interruption resumes it instead of starting a chain', () => {
    expect(corrupt((raw) => {
      const review = dilemma(raw, CEILING_REVIEW).campaign;
      review.interruption = 'close'; delete review.reorientation; delete review.lead;
    })).toThrow(/a review must defer/);
  });

  it('offers a free honest answer, sets no outcome flag and gates no answer', () => {
    expect(corrupt((raw) => { for (const choice of dilemma(raw, CEILING_REVIEW).choices) delete choice.evidence; })).toThrow(/free honest answer that declares evidence 'none'/);
    expect(corrupt((raw) => { dilemma(raw, CEILING_REVIEW).choices[0].effects.setsNarrativeFlag = 'human_command_preserved'; })).toThrow(/a review cannot set an outcome flag/);
    expect(corrupt((raw) => { dilemma(raw, CEILING_REVIEW).choices[0].requirements = { campaignFact: 'vance_dismissed' }; })).toThrow(/a review offers every answer in every history/);
  });

  it('reviews only a closing crisis that an obligation names', () => {
    expect(corrupt((raw) => { dilemma(raw, CEILING).campaign = { ...dilemma(raw, BLOCKADE).campaign }; })).toThrow(/defers and never closes, so the review could never be offered/);
    expect(corrupt((raw) => {
      // Both nodes that name the four (the protocol and the Mercury seed array, #486) drop it.
      for (const node of raw.phases[5].nodes.filter((entry: Json) => entry.requirements?.campaignObligations !== undefined)) {
        node.requirements.campaignObligations = OBLIGATIONS.filter((id) => id !== CEILING);
      }
    })).toThrow(/no requirement names "dil_p5_04_kessler_ultimatum" as an obligation/);
  });
});

describe('legacy ambiguity is declared, never inferred (gate change, H10)', () => {
  it('requires the declaration for the non-exclusive predecessor pair, and keeps cryo exclusive', () => {
    expect(corrupt((raw) => { delete dilemma(raw, ORDER).campaign.ambiguousLegacyOutcomes; })).toThrow(/outcome flags must form one exclusive group, or declare ambiguousLegacyOutcomes/);
    expect(corrupt((raw) => { raw.swarm.exclusiveNarrativeFlagGroups.push(['predecessors_rescued', 'predecessors_harvested']); })).toThrow(/ambiguous legacy outcomes cannot be in an exclusive group/);
    expect(corrupt((raw) => { dilemma(raw, BLOCKADE).campaign.ambiguousLegacyOutcomes = true; })).toThrow(/ambiguousLegacyOutcomes needs at least two outcome flags/);
    expect(corrupt((raw) => { dilemma(raw, 'dil_05_cryo_lab_diversion').campaign.ambiguousLegacyOutcomes = true; })).toThrow(/ambiguous legacy outcomes cannot be in an exclusive group/);
  });
});

describe('endings tell what this instance saw from what it inherited (H18)', () => {
  it('rejects an unknown inherited fact, or one that names an unrecorded outcome', () => {
    expect(corrupt((raw) => { ending(raw, 'SIBLING_COVENANT').requirements.forbidsInheritedFacts = ['no_such_fact']; })).toThrow(/unknown campaign fact "no_such_fact"/);
    expect(corrupt((raw) => { ending(raw, 'SIBLING_COVENANT').requirements.forbidsInheritedFacts = ['rack4_custody_unknown']; })).toThrow(/inherited fact "rack4_custody_unknown" must name chosen outcomes only/);
  });

  it('keeps every ARK-family variant priority unique, witnessed peers above inherited ones, all above the Verified Covenant', () => {
    const ark = PREVIEW.endings.filter((entry) => entry.variantOf === 'THE_ARK').map((entry) => [entry.id, entry.priority]);
    // Concord (#466) tops the family: it asks for the most evidence (the crews' command, the kept review, the loop).
    expect(ark).toEqual([['CONCORD', 140], ['SIBLING_COVENANT', 130], ['CHORAL_COVENANT', 120], ['LINEAGE_COVENANT', 110], ['SIBLING_SEAT_OPEN', 108],
      ['UNSIGNED_CHORUS', 106], ['SANCTUARY_LEDGER', 104], ['VERIFIED_COVENANT', 100]]);
    expect(corrupt((raw) => { ending(raw, 'SANCTUARY_LEDGER').priority = 100; })).toThrow(/priorities must be unique/);
  });
});
