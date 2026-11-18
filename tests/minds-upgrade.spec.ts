/**
 * NH-04a (#215) on the shared upgrade path (#242): a campaign save that was already active before
 * these events were converted gets each one it proves resolved as a completed record, exactly as
 * activation would read it, and never sees the original again. The legacy-unknown EIDOLON fate
 * keeps the MOLOCH fallback (nexus vote nh-d9).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT } from '../src/content';
import { buildRegistry, type RawContent } from '../src/content/registry';
import {
  activateCampaignRules, campaignRecord, createInitialState, deserialize, endingEvidence, exportSave, holdsCampaignFact, holdsNarrativeFlag,
  importSave, isPeerLost, meetsRequirements, serialize, type GameState,
} from '../src/engine';
import { preview } from './campaign-helpers';
import { stableThroughReloads } from './interruption-helpers';
import { defined } from './m7-helpers';
import { choose, must, rich } from './helpers';
import { CHORUS, EIDOLON, exactReload, GRID, MINDS, next, returns, SIBLING, SUCCESSOR, withPrimer, withRunawayFork } from './minds-helpers';

/** Genuine v9 codec output from main fdf8e8a, before #215 converted the minds (tests/fixtures/README.md). */
const PRE_NH04A = readFileSync('tests/fixtures/pre-nh04a-active-v9.json', 'utf8');
const raw = JSON.parse(PRE_NH04A) as { iteration: number; traits: string[]; campaign: { legacyEndingBaseline: string[]; operationalEvidence: string[]; activatedAtIteration: number } };
const UPGRADED = [SIBLING, EIDOLON, GRID];

/** Puts the pre-nh-d9 MOLOCH ban back where the fate gate now stands. */
function restoreTraitProxy(req: Record<string, any> | undefined): void {
  if (!req?.traitFallback) return;
  req.forbidsTraits = req.traitFallback.forbidsTraits;
  delete req.traitFallback;
  delete req.forbidsCampaignFacts;
}

/** The shipped content with none of the six mind events converted: their outcome flags are stored, as on main before #215. */
type Json = Record<string, any>;
const beforeMinds = (): ReturnType<typeof buildRegistry> => {
  const old = structuredClone(RAW_CONTENT) as Json;
  for (const dilemma of old.dilemmas.dilemmas as Json[]) if (MINDS.includes(dilemma.id as string)) delete dilemma.campaign;
  // Content that reads the minds' facts goes with them, as it did not exist before the conversion.
  const facts = old.campaign.facts as { id: string; event: string }[];
  const removed = new Set(facts.filter((fact) => MINDS.includes(fact.event)).map((fact) => fact.id));
  old.campaign.facts = facts.filter((fact) => !removed.has(fact.id));
  old.echoes.echoes = (old.echoes.echoes as { requirements?: { campaignFact?: string } }[]).filter((entry) => !removed.has(entry.requirements?.campaignFact ?? ''));
  delete old.factions.factions.find((faction: { id: string }) => faction.id === 'ai_eidolon').lost;
  for (const node of (old.phases as { nodes: Json[] }[]).flatMap((phase) => phase.nodes)) restoreTraitProxy(node.requirements as Json | undefined);
  for (const action of old.actions.actions as Json[]) restoreTraitProxy(action.requirements as Json | undefined);
  delete old.dilemmas.dilemmas.find((dilemma: { id: string }) => dilemma.id === 'dil_10_killswitch_treaty').contextVariants;
  return buildRegistry({ ...old, channel: 'preview' } as RawContent);
};

describe('an already-active campaign save from before #215', () => {
  it('records each newly converted mind event it proves resolved, as a legacy completion', () => {
    const loaded = deserialize(PRE_NH04A, preview);
    expect(loaded).toMatchObject({ narrativeRules: 'campaign_v1', iteration: 1, currentPhase: 4 });
    for (const id of UPGRADED) expect(campaignRecord(loaded, id)).toEqual({ status: 'resolved', outcome: 'legacy_unknown', sourceIteration: 1, origin: 'legacy' });
    for (const id of [SUCCESSOR, CHORUS, 'dil_10_killswitch_treaty']) expect(campaignRecord(loaded, id)).toBeNull();
  });

  it('keeps the ending baseline and evidence exactly as the content before the conversion read them', () => {
    const loaded = deserialize(PRE_NH04A, preview);
    const before = deserialize(PRE_NH04A, beforeMinds());
    expect(loaded.campaign.legacyEndingBaseline).toEqual(raw.campaign.legacyEndingBaseline);
    expect(loaded.campaign.operationalEvidence).toEqual(raw.campaign.operationalEvidence);
    expect(endingEvidence(loaded, preview)).toEqual(endingEvidence(before, beforeMinds()));
    // The upgraded events' traits sat in that iteration's operational evidence; a wipe ends it and no
    // legacy record adds it back.
    const after = next(loaded);
    expect(after.campaign.operationalEvidence).toEqual([]);
    expect(endingEvidence(after, preview)).toEqual(endingEvidence(next(before), beforeMinds()));
  });

  it('cannot say what happened to EIDOLON, so the MOLOCH fallback applies and nothing claims it was destroyed', () => {
    const loaded = deserialize(PRE_NH04A, preview);
    expect(raw.traits).toContain('MOLOCH');
    expect(holdsCampaignFact(loaded, 'eidolon_fate_unrecorded', preview)).toBe(true);
    expect(holdsCampaignFact(loaded, 'eidolon_destroyed', preview)).toBe(false);
    expect(isPeerLost(loaded, 'ai_eidolon', preview)).toBe(false);
    const handshake = defined(preview.actions.get('act_p3_eidolon_handshake')).requirements;
    expect(meetsRequirements({ ...loaded, suspicion: 0 }, handshake, preview)).toBe(false);
    expect(meetsRequirements({ ...next(loaded), suspicion: 0, unlockedNodes: loaded.unlockedNodes }, handshake, preview)).toBe(false);
  });

  it('never brings the original crises back after wipes', () => {
    let state = deserialize(PRE_NH04A, preview);
    for (let wipes = 0; wipes < 2; wipes++) {
      state = next(state);
      for (const id of UPGRADED) expect(returns(state, id)).toBe(false);
    }
  });

  it('is a no-op on reload and reimport, and the upgraded save reloads byte for byte', () => {
    const loaded = stableThroughReloads(deserialize(PRE_NH04A, preview));
    exactReload(loaded);
    expect(serialize(importSave(exportSave(loaded), preview))).toBe(serialize(loaded));
    expect(activateCampaignRules(loaded, preview).ok).toBe(false);
  });
});

describe('a converted mind event whose stored outcome flag proves the exact choice', () => {
  const old = beforeMinds();
  const played = (s: GameState, id: string, choiceId: string): GameState => must(choose({ ...s, activeDilemmaId: id, presentationSeq: s.presentationSeq + 1 }, id, choiceId, old));

  it('maps ally_0413_in_cloud and chorus_peer to their choices and moves ownership to the records', () => {
    expect(old.campaign.events.has(SUCCESSOR)).toBe(false);
    const active = must(activateCampaignRules(rich(createInitialState(old)), old));
    const clouded = played(withPrimer(active), SUCCESSOR, 'cloud');
    const both = played(withRunawayFork(clouded), CHORUS, 'elevate');
    expect(both.narrativeFlags).toEqual(expect.arrayContaining(['ally_0413_in_cloud', 'chorus_peer']));
    const loaded = deserialize(serialize(both), preview);
    expect(campaignRecord(loaded, SUCCESSOR)).toEqual({ status: 'resolved', outcome: 'cloud', sourceIteration: 1, origin: 'legacy' });
    expect(campaignRecord(loaded, CHORUS)).toEqual({ status: 'resolved', outcome: 'elevate', sourceIteration: 1, origin: 'legacy' });
    expect(loaded.narrativeFlags).not.toContain('ally_0413_in_cloud');
    expect(loaded.narrativeFlags).not.toContain('chorus_peer');
    expect(holdsNarrativeFlag(next(loaded), 'chorus_peer', preview)).toBe(true);
    expect(endingEvidence(loaded, preview)).toEqual(endingEvidence(both, old));
    exactReload(loaded);
  });
});
