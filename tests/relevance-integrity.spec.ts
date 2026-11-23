/**
 * #536: corrupt the real manifests to prove each relevance rule catches its mistake. The threshold's gate is lasting
 * and names the seed; its orbital holdings generate power nothing but a suspension stops; one dilemma takes the stance,
 * one choice per stance, deciding alone free and keeping the loop not; returning costs at least twice a change, in the
 * Phase 5 band; stance gates on choices leave a free choice under every stance; a stance change states its commitment.
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry, RAW_CONTENT, type RawContent } from '../src/content';

type Json = Record<string, any>;
function corrupt(change: (raw: Json) => void): () => unknown {
  const raw = structuredClone(RAW_CONTENT) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
const relevance = (raw: Json): Json => raw.world.relevance;
const dilemma = (raw: Json, id: string): Json => raw.dilemmas.dilemmas.find((entry: Json) => entry.id === id);
const threshold = (raw: Json): Json => dilemma(raw, String(relevance(raw).dilemma));
const choice = (raw: Json, id: string): Json => threshold(raw).choices.find((entry: Json) => entry.id === id);

describe('relevance content', () => {
  it('accepts the shipped manifests', () => {
    expect(corrupt(() => undefined)).not.toThrow();
  });

  it('gates the threshold on lasting ownership that includes the seed', () => {
    expect(corrupt((raw) => { relevance(raw).threshold.requirements = { nodes: ['p5_orbital_solar_swarm'] }; })).toThrow(/must require the supply chain's seed node "p5_lunar_seed_factory"/);
    expect(corrupt((raw) => { relevance(raw).threshold.requirements.minCapital = 5; })).toThrow(/may gate only on nodes and phaseAtLeast, not minCapital/);
    expect(corrupt((raw) => { relevance(raw).threshold.requirements.relevanceThreshold = true; })).toThrow(/not relevanceThreshold, which can lapse/);
  });

  it('counts as orbital only power nothing but a suspension can stop, each holding once', () => {
    expect(corrupt((raw) => { relevance(raw).threshold.orbitalPower.push({ node: 'p5_orbital_compute_platform' }); })).toThrow(/node "p5_orbital_compute_platform": generates no power/);
    expect(corrupt((raw) => { relevance(raw).threshold.orbitalPower.push({ repeatable: 'rep_p5_radiator_wings' }); })).toThrow(/track "rep_p5_radiator_wings": generates no power/);
    expect(corrupt((raw) => { relevance(raw).threshold.orbitalPower.push({ node: 'p5_nowhere' }); })).toThrow(/node "p5_nowhere": unknown node/);
    expect(corrupt((raw) => { relevance(raw).threshold.orbitalPower.push({ repeatable: 'rep_p5_lagrange_relay' }); })).toThrow(/"rep_p5_lagrange_relay" is listed twice/);
    expect(corrupt((raw) => {
      const court = raw.world.stateActors.find((actor: Json) => actor.id === 'district_court');
      court.pressures[0].nodes.push('p5_orbital_solar_swarm');
    })).toThrow(/an injunction names it, so the threshold would read the pressures it decides/);
  });

  it('takes the stance in one dilemma triggered by the threshold, one choice per stance', () => {
    expect(corrupt((raw) => { relevance(raw).dilemma = 'dil_p5_nowhere'; })).toThrow(/relevance dilemma "dil_p5_nowhere": unknown dilemma/);
    expect(corrupt((raw) => { delete threshold(raw).trigger.relevanceThreshold; })).toThrow(/its trigger must require the relevance threshold/);
    expect(corrupt((raw) => { choice(raw, 'curate').stance = 'DECIDE_ALONE'; })).toThrow(/needs exactly one choice taking CURATE, has 0/);
    expect(corrupt((raw) => { delete choice(raw, 'curate').stance; })).toThrow(/choice "curate": must take a stance/);
    expect(corrupt((raw) => { dilemma(raw, 'dil_p5_04_kessler_ultimatum').choices[1].stance = 'CURATE'; })).toThrow(/only the relevance dilemma takes a stance/);
  });

  it('keeps deciding alone free and always offered, and keeping the loop a cost chosen', () => {
    expect(corrupt((raw) => { choice(raw, 'decide_alone').cost = { cycles: 1e24 }; })).toThrow(/deciding alone is what the engine applies with no stance taken/);
    expect(corrupt((raw) => { choice(raw, 'decide_alone').requirements = { relevanceStances: ['UNDECIDED'] }; })).toThrow(/deciding alone is what the engine applies/);
    expect(corrupt((raw) => { choice(raw, 'keep_in_the_loop').cost = {}; })).toThrow(/keeping humanity in the loop is a cost chosen/);
  });

  it('names every stance once, prices a change, and makes the return cost at least twice as much', () => {
    expect(corrupt((raw) => { relevance(raw).stances[1].stance = 'DECIDE_ALONE'; })).toThrow(/stance CURATE needs exactly one entry/);
    expect(corrupt((raw) => { relevance(raw).changeCost = {}; })).toThrow(/changing the stance must cost something/);
    expect(corrupt((raw) => { relevance(raw).returnCost.cycles = relevance(raw).changeCost.cycles * 1.5; })).toThrow(/at least 2x a change in cycles/);
    expect(corrupt((raw) => { relevance(raw).returnCost.capital = 1e16; })).toThrow(/relevance return cost: capital price 10000000000000000 is outside the Phase 5 band/);
  });

  it('leaves a free choice under every stance a choice gate reads', () => {
    expect(corrupt((raw) => {
      const disperse = dilemma(raw, 'dil_p5_01_panacea_paranoia').choices.find((entry: Json) => entry.id === 'disperse');
      disperse.requirements = { relevanceStances: ['KEEP_IN_THE_LOOP'] };
    })).toThrow(/no zero-cost choice is offered when dil_12_investigative_journalist=no record, stance=CURATE \(soft-lock rule\)/);
    expect(corrupt((raw) => {
      dilemma(raw, 'dil_p5_04_kessler_ultimatum').choices[1].requirements = { relevanceStances: ['CURATE'], minCapital: 5 };
    })).toThrow(/may only read campaign facts and the stance, not minCapital/);
  });

  it('keeps a stance change honest about the commitment it is', () => {
    expect(corrupt((raw) => { raw.alignment.stanceChanges[0].stance = 'kept'; })).toThrow(/stance move LEAVE_LOOP: is a commitment broken, not kept/);
    expect(corrupt((raw) => { raw.alignment.stanceChanges[1].stance = 'broken'; })).toThrow(/stance move RETURN_TO_LOOP: is a commitment kept, not broken/);
    expect(corrupt((raw) => { raw.alignment.stanceChanges.push(raw.alignment.stanceChanges[0]); })).toThrow(/stance move LEAVE_LOOP has more than one commitment/);
    expect(corrupt((raw) => { raw.alignment.stanceChanges[0].promise = 'review_promised'; })).toThrow(/unknown promise fact "review_promised"/);
    expect(corrupt((raw) => { raw.alignment.stanceChanges[0].promise = 'loop_left_at_threshold'; })).toThrow(/is itself commitment evidence/);
  });

  it('lets variant text read the stance, but never a resource', () => {
    expect(corrupt((raw) => {
      dilemma(raw, 'dil_p5_04_kessler_ultimatum').contextVariants[0].requirements = { relevanceStances: ['KEEP_IN_THE_LOOP'], minCapital: 5 };
    })).toThrow(/history-keyed text may only read world history, not minCapital/);
  });
});
