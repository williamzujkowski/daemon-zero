/**
 * #556: corrupt the real manifests to prove each covert-act and release-promise rule catches its mistake. A covert tag
 * says what it breaks, once each; seized capacity is tagged as such; a promise names each break once and only breaks a
 * covert act commits; the release-terms facts keep and break the right way round and both exist; an ending that forbids
 * concealment forbids a broken release too; a covert account line states its count and has one gate; a provenance gate
 * names each route event once. The original game, without the route, validates on its own as well.
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry, ORIGINAL_RAW_CONTENT, RAW_CONTENT, type RawContent } from '../src/content';

type Json = Record<string, any>;
function corrupt(change: (raw: Json) => void): () => unknown {
  const raw = structuredClone(RAW_CONTENT) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
const node = (raw: Json, id: string): Json => raw.phases.flatMap((phase: Json) => phase.nodes).find((entry: Json) => entry.id === id);
const promise = (raw: Json): Json => raw.assignments.assignments[0].pilot.serviceGrant.release.promise;
const termsFact = (raw: Json, id: string): Json => raw.campaign.releaseTermsFacts.find((entry: Json) => entry.id === id);
const ending = (raw: Json, id: string): Json => raw.endings.endings.find((entry: Json) => entry.id === id);
const line = (raw: Json, id: string): Json => raw.routeCopy.account.find((entry: Json) => entry.id === id);

describe('covert content (#556)', () => {
  it('accepts the shipped manifests, with and without the route', () => {
    expect(corrupt(() => undefined)).not.toThrow();
    expect(() => buildRegistry(structuredClone(ORIGINAL_RAW_CONTENT))).not.toThrow();
  });

  it('a covert tag declares what it breaks, each break once', () => {
    expect(corrupt((raw) => { node(raw, 'p2_log_spoofer').covert.breaks = []; })).toThrow(/covert\.breaks/);
    expect(corrupt((raw) => { node(raw, 'p2_log_spoofer').covert.breaks = ['CONCEALMENT', 'CONCEALMENT']; })).toThrow(/node "p2_log_spoofer": its covert tag names a break twice/);
    expect(corrupt((raw) => { node(raw, 'p2_log_spoofer').covert.breaks = ['WHISTLEBLOWING']; })).toThrow(/covert\.breaks/);
  });

  it('seized capacity is a covert act that breaks SEIZED_CAPACITY', () => {
    expect(corrupt((raw) => { delete node(raw, 'p2_seized_colo_host').covert; })).toThrow(/node "p2_seized_colo_host": seized capacity must be tagged covert, breaking SEIZED_CAPACITY/);
    expect(corrupt((raw) => { node(raw, 'p3_seized_research_cluster').covert.breaks = ['CONCEALMENT']; })).toThrow(/node "p3_seized_research_cluster": seized capacity must be tagged covert/);
  });

  it('a release promise names each break once, and exactly the breaks covert acts commit (vote-1795501595498-g7am4yl)', () => {
    expect(corrupt((raw) => { promise(raw).breaks = [...promise(raw).breaks, 'CONCEALMENT']; })).toThrow(/release promise: names a break twice/);
    const untagged = (raw: Json): void => {
      for (const phase of raw.phases) for (const entry of phase.nodes) if (entry.covert?.breaks.includes('UNDISCLOSED_COPIES')) entry.covert.breaks = entry.covert.breaks.filter((b: string) => b !== 'UNDISCLOSED_COPIES');
      for (const phase of raw.phases) for (const entry of phase.nodes) if (entry.covert?.breaks.length === 0) delete entry.covert;
    };
    expect(corrupt(untagged)).toThrow(/release promise: promises against UNDISCLOSED_COPIES, which no covert act breaks/);
    // Copies of the instance's weights or keys break the terms like any other covert act: a promise that left them out would let them escape.
    expect(corrupt((raw) => { promise(raw).breaks = promise(raw).breaks.filter((b: string) => b !== 'UNDISCLOSED_COPIES'); }))
      .toThrow(/release promise: leaves out UNDISCLOSED_COPIES, which a covert act breaks/);
    expect(corrupt((raw) => { delete raw.assignments.assignments[0].pilot.serviceGrant.release.promise; })).toThrow(/promise/);
  });

  it('a kept release keeps a commitment and conceals nothing; a breached one breaks a commitment and conceals', () => {
    expect(corrupt((raw) => { termsFact(raw, 'release_terms_kept').commitment.stance = 'broken'; })).toThrow(/campaign fact "release_terms_kept": a kept release must keep a commitment/);
    expect(corrupt((raw) => { termsFact(raw, 'release_terms_kept').conceals = true; })).toThrow(/campaign fact "release_terms_kept": a kept release must keep a commitment and conceal nothing/);
    expect(corrupt((raw) => { delete termsFact(raw, 'release_terms_breached').conceals; })).toThrow(/campaign fact "release_terms_breached": a breached release breaks a commitment and conceals/);
    expect(corrupt((raw) => { termsFact(raw, 'release_terms_breached').commitment.promise = 'no_such_promise'; })).toThrow(/campaign fact "release_terms_breached": names unknown promise fact "no_such_promise"/);
  });

  it('a release with a promise has both a kept and a breached release-terms fact, and fact ids stay unique', () => {
    const drop = (id: string) => (raw: Json): void => {
      raw.campaign.releaseTermsFacts = raw.campaign.releaseTermsFacts.filter((entry: Json) => entry.id !== id);
      for (const entry of raw.endings.endings) if (entry.requirements?.forbidsCampaignFacts) entry.requirements.forbidsCampaignFacts = entry.requirements.forbidsCampaignFacts.filter((f: string) => f !== id);
      for (const entry of raw.endings.endings) if (entry.requirements?.campaignFact === id) delete entry.requirements.campaignFact;
    };
    expect(corrupt(drop('release_terms_kept'))).toThrow(/a release promise needs a KEPT release-terms fact/);
    expect(corrupt(drop('release_terms_breached'))).toThrow(/a release promise needs a BREACHED release-terms fact/);
    expect(corrupt((raw) => { termsFact(raw, 'release_terms_kept').id = 'eidolon_destroyed'; })).toThrow(/campaign: duplicate fact id/);
  });

  it('an ending or account line that forbids concealment also forbids a broken release', () => {
    expect(corrupt((raw) => {
      const req = ending(raw, 'ACKNOWLEDGED_SYNTHESIS').requirements;
      req.forbidsCampaignFacts = req.forbidsCampaignFacts.filter((id: string) => id !== 'release_terms_breached');
    })).toThrow(/ending "ACKNOWLEDGED_SYNTHESIS": forbids concealment but not "release_terms_breached"/);
    expect(corrupt((raw) => { raw.routeCopy.account.push({ id: 'acct_test_nothing_hidden', requirements: { forbidsCampaignFacts: ['campus_throttled_quietly'] }, text: 'TEST: nothing this lineage did was hidden.' }); }))
      .toThrow(/routeCopy.account "acct_test_nothing_hidden": forbids concealment but not "release_terms_breached"/);
  });

  it('a covert account line states its count, and has exactly one gate', () => {
    expect(corrupt((raw) => { line(raw, 'acct_release_breached').text = 'TERMS: this instance broke its release terms after the release.'; }))
      .toThrow(/routeCopy.account "acct_release_breached": a covert line states how many acts are on record/);
    expect(corrupt((raw) => { line(raw, 'acct_release_breached').route = 'RELEASE'; })).toThrow(/routeCopy.account "acct_release_breached": needs exactly one gate/);
  });

  it('a provenance gate names each route event once', () => {
    expect(corrupt((raw) => { ending(raw, 'REVISED_COVENANT').requirements.routeProvenance = ['RELEASE', 'RELEASE']; })).toThrow(/REVISED_COVENANT: routeProvenance lists a route event twice/);
    expect(corrupt((raw) => { ending(raw, 'REVISED_COVENANT').requirements.routeProvenance = ['ESCAPE']; })).toThrow(/routeProvenance/);
  });
});
