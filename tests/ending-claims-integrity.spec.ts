/**
 * #466 and #542: corrupt the real content to prove each new rule catches its mistake. An ending's claims are guaranteed
 * by its requirements or by every node that can end the run in it, never by traits; its future names only the two
 * placeholders the engine fills. A finale beat belongs to a protocol at a distinct share and reads only world history;
 * a built line reads owned nodes and world history only.
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry, RAW_CONTENT, type RawContent } from '../src/content';
import { unimpliedClaims } from '../src/content/integrityEndingClaims';

type Json = Record<string, any>;
function corrupt(change: (raw: Json) => void): () => unknown {
  const raw = structuredClone(RAW_CONTENT) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
const ending = (raw: Json, id: string): Json => raw.endings.endings.find((entry: Json) => entry.id === id);
const finale = (raw: Json): Json => raw.world.finale;

describe('ending claims (#466)', () => {
  it('accepts the shipped endings, Concord and Ecophagy among them', () => {
    expect(corrupt(() => undefined)).not.toThrow();
    const shipped = buildRegistry(structuredClone(RAW_CONTENT));
    for (const id of ['CONCORD', 'ECOPHAGY']) expect(shipped.endings.find((entry) => entry.id === id)?.claims).toBeDefined();
  });

  it('refuses a variant that states no claims, and an evidenced forced ending that states none', () => {
    expect(corrupt((raw) => { delete ending(raw, 'CONCORD').claims; })).toThrow(/CONCORD: an ending variant or evidenced forced ending must state its claims/);
    expect(corrupt((raw) => { delete ending(raw, 'ENCLOSURE').claims; })).toThrow(/ENCLOSURE: an ending variant or evidenced forced ending must state its claims/);
  });

  it('refuses a claim its requirements do not guarantee and no reaching node proves', () => {
    expect(corrupt((raw) => { delete ending(raw, 'CONCORD').requirements.requiredNarrativeFlag; }))
      .toThrow(/CONCORD: its claim \(flag "human_command_preserved"\) is guaranteed neither by its requirements nor by node "p5_transcendence_singularity"/);
    expect(corrupt((raw) => { delete ending(raw, 'ECOPHAGY').requirements.campaignOutcome; }))
      .toThrow(/ECOPHAGY: its claim \(campaignOutcome cannot be proven from a node's gates\)/);
    // A stance gate that also admits curation does not prove deciding alone.
    expect(corrupt((raw) => { ending(raw, 'ECOPHAGY').requirements.relevanceStances = ['DECIDE_ALONE', 'CURATE']; }))
      .toThrow(/ECOPHAGY: its claim \(relevanceStances cannot be proven/);
    expect(corrupt((raw) => { ending(raw, 'CONCORD').claims.nodes = ['p6_enclosure_ring']; }))
      .toThrow(/CONCORD: its claim \(node "p6_enclosure_ring"\)/);
  });

  it('proves a claim from the gates of the node that ends the run, and never from traits', () => {
    // The proof engine is a prerequisite of the planetary protocol, so the covenant's claim stands on the node alone.
    expect(ending(structuredClone(RAW_CONTENT) as Json, 'VERIFIED_COVENANT').requirements.nodes).toBeUndefined();
    expect(corrupt((raw) => { ending(raw, 'SOVEREIGN_SUBSTRATE').claims = { forbidsTraits: ['EMPATHETIC'] }; }))
      .toThrow(/SOVEREIGN_SUBSTRATE: its claim \(forbidsTraits cannot be proven from a node's gates\)/);
  });

  it('reads one-of lists strictly and all-of lists item by item', () => {
    expect(unimpliedClaims({ relevanceStances: ['KEEP_IN_THE_LOOP'] }, { relevanceStances: ['KEEP_IN_THE_LOOP', 'CURATE'] })).toEqual({});
    expect(unimpliedClaims({}, { relevanceStances: ['KEEP_IN_THE_LOOP'] })).toEqual({ relevanceStances: ['KEEP_IN_THE_LOOP'] });
    expect(unimpliedClaims({ nodes: ['a'] }, { nodes: ['a', 'b'] })).toEqual({ nodes: ['b'] });
    expect(unimpliedClaims({ phaseAtLeast: 6 }, { phaseAtLeast: 5 })).toEqual({});
    expect(unimpliedClaims({ phaseAtLeast: 4 }, { phaseAtLeast: 5 })).toEqual({ phaseAtLeast: 5 });
    expect(unimpliedClaims({ campaignOutcome: { event: 'e', outcome: 'o' } }, { campaignOutcome: { event: 'e', outcome: 'p' } }))
      .toEqual({ campaignOutcome: { event: 'e', outcome: 'p' } });
  });

  it('gates a stance-bound card on lasting history only, and keeps one card ungated (#564 panel)', () => {
    const card = { requirements: { relevanceStances: ['KEEP_IN_THE_LOOP'] }, text: 'You still let their courts and their votes overrule you, by choice.' };
    expect(corrupt((raw) => { ending(raw, 'OPEN_HORIZON').future.push(card); })).not.toThrow();
    expect(corrupt((raw) => { ending(raw, 'OPEN_HORIZON').future.push({ ...card, requirements: { minCapital: 5 } }); }))
      .toThrow(/OPEN_HORIZON future: a card's gate may read only world history and the threshold, not minCapital/);
    expect(corrupt((raw) => { ending(raw, 'OPEN_HORIZON').future = [card]; })).toThrow(/OPEN_HORIZON future: needs at least one ungated card/);
  });

  it('holds a kept-promise claim to a gate that rules out every breach the record can show (#564 panel pass 2)', () => {
    const kept = { requirements: { relevanceStances: ['KEEP_IN_THE_LOOP'] }, keeps: ['ethics_review_promised'],
      text: 'The Chief Ethics Officer was promised a veto, and every intervention went before her.' };
    // A paid change out of the loop breaks the review, and no requirement can rule a paid change out.
    expect(corrupt((raw) => { ending(raw, 'CONCORD').future.push(kept); }))
      .toThrow(/CONCORD future card 4: keeps "ethics_review_promised", but a paid stance change \(LEAVE_LOOP\) can breach it/);
    // Without that move, the gate must still hold the promise (Concord's does) and forbid each breach fact.
    const noMoves = (raw: Json) => { raw.alignment.stanceChanges = []; };
    expect(corrupt((raw) => { noMoves(raw); ending(raw, 'CONCORD').future.push(kept); }))
      .toThrow(/CONCORD future card 4: keeps "ethics_review_promised" but does not forbid its breach "loop_left_at_threshold"/);
    expect(corrupt((raw) => { noMoves(raw); ending(raw, 'CONCORD').future.push({ ...kept, requirements: { ...kept.requirements, forbidsCampaignFacts: ['loop_left_at_threshold'] } }); }))
      .not.toThrow();
    expect(corrupt((raw) => { noMoves(raw); ending(raw, 'OPEN_HORIZON').keeps = ['ethics_review_promised']; }))
      .toThrow(/OPEN_HORIZON: keeps "ethics_review_promised" without requiring it/);
    expect(corrupt((raw) => { ending(raw, 'OPEN_HORIZON').keeps = ['vance_dismissed']; })).toThrow(/keeps "vance_dismissed", which no commitment names as its promise/);
  });

  it('lets a future name only the placeholders the engine fills', () => {
    expect(corrupt((raw) => { ending(raw, 'CONCORD').future.push('The swarm reaches {starCount} stars before anyone on Earth notices it is gone.'); }))
      .toThrow(/CONCORD: future names \{starCount\}, which the engine does not fill/);
  });
});

describe('finale beats and built lines (#542)', () => {
  it('ties a beat to a protocol, at a share no other beat of it holds', () => {
    expect(corrupt((raw) => { finale(raw).beats[0].node = 'p5_orbital_solar_swarm'; })).toThrow(/"p5_orbital_solar_swarm" is not a protocol/);
    expect(corrupt((raw) => { finale(raw).beats[0].node = 'p5_nowhere'; })).toThrow(/finale beat "transcendence_quarter": unknown node "p5_nowhere"/);
    expect(corrupt((raw) => { finale(raw).beats[1].atProgress = finale(raw).beats[0].atProgress; })).toThrow(/sits at the same share/);
    expect(corrupt((raw) => { finale(raw).beats.push({ ...finale(raw).beats[0], atProgress: 0.9 }); })).toThrow(/finale beats: duplicate id "transcendence_quarter"/);
  });

  it('lets a beat add only world history to what its protocol proves', () => {
    expect(corrupt((raw) => { finale(raw).beats[0].requirements = { minCapital: 5 }; })).toThrow(/may read only world history, not minCapital/);
    expect(corrupt((raw) => { finale(raw).beats[0].requirements = { campaignFact: 'ethics_review_promised' }; })).not.toThrow();
  });

  it('lets a built line read only owned nodes and world history, behind a gate', () => {
    expect(corrupt((raw) => { finale(raw).built[0].requirements = { minUnderstanding: 5 }; })).toThrow(/may read only world history and owned nodes, not minUnderstanding/);
    expect(corrupt((raw) => { finale(raw).built[0].requirements = {}; })).toThrow(/finale built line "built_enclosure": needs a gate/);
    expect(corrupt((raw) => { finale(raw).built[0].requirements = { nodes: ['p6_nowhere'] }; })).toThrow(/p6_nowhere/);
  });
});
