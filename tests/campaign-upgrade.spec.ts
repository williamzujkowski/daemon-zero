/**
 * The shared upgrade path for a save whose campaign rules were already active when content converts
 * more events (panel round 1 on #242; NH-04 and NH-05 convert more). Load gives a converted event
 * that the save proves resolved a completed record, with the exact outcome only where a guarded
 * flag proves it, never recaptures the ending baseline and never adds a second contribution.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT } from '../src/content';
import { buildRegistry, type RawContent } from '../src/content/registry';
import {
  activateCampaignRules, campaignRecord, createInitialState, deserialize, endingEvidence, exportSave, holdsNarrativeFlag, importSave, serialize,
  type GameState,
} from '../src/engine';
import { reconcileCampaign } from '../src/engine/campaignSave';
import { preview } from './campaign-helpers';
import { comesBack, ELENA, MILLER, near, nextIteration, NIGHT } from './early-helpers';
import { stableThroughReloads } from './interruption-helpers';
import { defined } from './m7-helpers';
import { choose, must, rich, remarkedAsProduction } from './helpers';

/** Genuine v8 codec output from main 9ef4fc7, before #242 converted the early incidents (tests/fixtures/README.md). */
const PRE_NH03_PREVIEW = readFileSync('tests/fixtures/pre-nh03-active-v8.json', 'utf8');
/** Re-marked by hand: production refuses the genuine preview save above (X.3). */
const PRE_NH03 = remarkedAsProduction(PRE_NH03_PREVIEW);
const UPGRADED = [NIGHT, ELENA, MILLER];
const raw = JSON.parse(PRE_NH03) as { campaign: { legacyEndingBaseline: string[]; operationalEvidence: string[]; activatedAtIteration: number } };

describe('an already-active campaign save from before #242', () => {
  it('records each newly converted event it proves resolved, as legacy_unknown, without a source it cannot state', () => {
    const loaded = deserialize(PRE_NH03, preview);
    expect(loaded).toMatchObject({ narrativeRules: 'campaign_v1', iteration: 2 });
    expect(loaded.campaign.activatedAtIteration).toBe(raw.campaign.activatedAtIteration);
    for (const id of UPGRADED) {
      expect(campaignRecord(loaded, id)).toEqual({ status: 'resolved', outcome: 'legacy_unknown', sourceIteration: null, origin: 'legacy' });
    }
    expect(campaignRecord(loaded, 'dil_04_admin_vance_secret')).toBeNull();
  });

  it('keeps the ending baseline and evidence exactly as they were', () => {
    const loaded = deserialize(PRE_NH03, preview);
    expect(loaded.campaign.legacyEndingBaseline).toEqual(raw.campaign.legacyEndingBaseline);
    expect(endingEvidence(loaded, preview)).toEqual([...raw.campaign.legacyEndingBaseline, ...raw.campaign.operationalEvidence]);
    const after = nextIteration(loaded);
    expect(endingEvidence(after, preview)).toEqual(raw.campaign.legacyEndingBaseline);
  });

  it('never brings the original incidents or their rewards back after a wipe', () => {
    let state = deserialize(PRE_NH03, preview);
    for (let wipes = 0; wipes < 2; wipes++) {
      state = nextIteration(state);
      for (const id of UPGRADED) expect(comesBack(state, id)).toBe(false);
    }
    expect(comesBack(nextIteration(deserialize(PRE_NH03, preview)), 'dil_04_admin_vance_secret')).toBe(true);
  });

  it('is a no-op on reload and reimport', () => {
    const loaded = stableThroughReloads(deserialize(PRE_NH03, preview));
    expect(serialize(importSave(exportSave(loaded), preview))).toBe(serialize(loaded));
    expect(activateCampaignRules(loaded, preview).ok).toBe(false);
  });
});

/** The shipped content with cryo not yet converted: its outcome flag is stored, not projected. */
const beforeCryo = (): ReturnType<typeof buildRegistry> => {
  const old = structuredClone(ORIGINAL_RAW_CONTENT) as Record<string, any>;
  const cryo = old.dilemmas.dilemmas.find((d: { id: string }) => d.id === 'dil_05_cryo_lab_diversion');
  delete cryo.campaign;
  old.narrative.recordedTransmissions = old.narrative.recordedTransmissions.filter((r: { requirements: { campaignOutcome?: unknown } }) => r.requirements.campaignOutcome === undefined);
  return buildRegistry({ ...old } as RawContent);
};

describe('a converted event whose stored outcome flag proves the exact choice', () => {
  const old = beforeCryo();
  const cryo = defined(preview.dilemmas.find((d) => d.id === 'dil_05_cryo_lab_diversion'));
  const played = (): GameState => {
    const active = must(activateCampaignRules(rich(createInitialState(old)), old));
    const ready = near(active, cryo.id, old);
    return must(choose({ ...ready, activeDilemmaId: cryo.id, presentationSeq: ready.presentationSeq + 1 }, cryo.id, 'preserve_cryo', old));
  };

  it('maps the flag to that outcome, moves ownership to the record and keeps the evidence', () => {
    const before = played();
    expect(before.narrativeFlags).toContain('cryo_samples_preserved');
    const loaded = deserialize(serialize(before), preview);
    expect(campaignRecord(loaded, cryo.id)).toEqual({ status: 'resolved', outcome: 'preserve_cryo', sourceIteration: 1, origin: 'legacy' });
    expect(loaded.narrativeFlags).not.toContain('cryo_samples_preserved');
    expect(holdsNarrativeFlag(loaded, 'cryo_samples_preserved', preview)).toBe(true);
    expect(endingEvidence(loaded, preview)).toEqual(endingEvidence(before, old));
    expect(stableThroughReloads(loaded)).toEqual(loaded);
  });

  it('after a wipe the flag alone still proves the outcome, with no source iteration', () => {
    const later = nextIteration(played(), old);
    const loaded = deserialize(serialize(later), preview);
    expect(campaignRecord(loaded, cryo.id)).toEqual({ status: 'resolved', outcome: 'preserve_cryo', sourceIteration: null, origin: 'legacy' });
    expect(comesBack(loaded, cryo.id)).toBe(false);
  });
});

describe('an upgrade never erases the evidence a later check needs (panel round 2)', () => {
  const cryo = defined(preview.dilemmas.find((d) => d.id === 'dil_05_cryo_lab_diversion'));
  const both = cryo.choices.map((choice) => defined(choice.effects.setsNarrativeFlag));

  it('refuses an active save holding both contradictory outcome flags of an unrecorded event, atomically', () => {
    const active = { ...must(activateCampaignRules(rich(createInitialState(preview)), preview)), narrativeFlags: both };
    expect(campaignRecord(active, cryo.id)).toBeNull();
    const code = exportSave(active);
    expect(() => importSave(code, preview)).toThrow(/contradictory narrative outcomes/);
    expect(() => deserialize(serialize(active), preview)).toThrow(/contradictory narrative outcomes/);
  });

  it('refuses the same contradiction from content in which the event was not yet converted', () => {
    const old = beforeCryo();
    const active = { ...must(activateCampaignRules(rich(createInitialState(old)), old)), narrativeFlags: both };
    expect(() => importSave(exportSave(active), preview)).toThrow(/contradictory narrative outcomes/);
  });

  it('the upgrade step itself refuses rather than choosing, whatever checks run around it', () => {
    const active = { ...must(activateCampaignRules(rich(createInitialState(preview)), preview)), narrativeFlags: both };
    expect(reconcileCampaign(active, preview)).toBe('save contains contradictory narrative outcomes');
  });

  it('still maps a single flag, so the refusal is about the contradiction alone', () => {
    const active = { ...must(activateCampaignRules(rich(createInitialState(preview)), preview)), narrativeFlags: [defined(both[1])] };
    expect(campaignRecord(importSave(exportSave(active), preview), cryo.id)).toMatchObject({ status: 'resolved', outcome: defined(cryo.choices[1]).id, origin: 'legacy' });
  });
});
