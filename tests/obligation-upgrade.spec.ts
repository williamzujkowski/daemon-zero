/**
 * The #214 upgrade path for the NH-05 conversions: a campaign that was active on main before the
 * Phase 5 crises became campaign records holds three of them in this iteration's resolvedDilemmas
 * with no record, and two of their outcome flags stored. Load gives each a legacy completion (the
 * flag gives the exact choice and moves into the record), never recaptures the ending baseline,
 * never brings a completed crisis back, and leaves the fourth obligation open. Input: a genuine v11
 * save from main 6d6973e (tests/fixtures/README.md).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  activateCampaignRules, campaignRecord, deserialize, endingEvidence, exportSave, holdsNarrativeFlag, importSave, obligationReceipt,
  serialize, unlockNode,
} from '../src/engine';
import { preview } from './campaign-helpers';
import { comesBack, nextIteration } from './early-helpers';
import { stableThroughReloads } from './interruption-helpers';
import { exactReload, own, play } from './minds-helpers';
import { must } from './helpers';
import { ATMOSPHERE, BLOCKADE, beforeNh05, CEILING, finalNode, OBLIGATIONS, ORDER } from './obligation-helpers';

/** Genuine v11 codec output from main 6d6973e, before NH-05 converted the Phase 5 crises (tests/fixtures/README.md). */
const PRE_NH05 = readFileSync('tests/fixtures/pre-nh05-active-v11.json', 'utf8');
const raw = JSON.parse(PRE_NH05) as { iteration: number; resolvedDilemmas: string[]; narrativeFlags: string[]; campaign: { events: Record<string, unknown>; legacyEndingBaseline: string[]; operationalEvidence: string[] } };
const DONE = [BLOCKADE, ORDER, ATMOSPHERE];

describe('an already-active campaign save from before NH-05', () => {
  it('is the save the tests describe: three Phase 5 crises resolved this iteration, two outcome flags stored, no records', () => {
    expect(raw.iteration).toBe(1);
    for (const id of DONE) {
      expect(raw.resolvedDilemmas).toContain(id);
      expect(raw.campaign.events[id]).toBeUndefined();
    }
    expect(raw.resolvedDilemmas).not.toContain(CEILING);
    expect(raw.narrativeFlags).toEqual(['predecessors_harvested', 'neurocalming_authorized']);
  });

  it('records each as a legacy completion; a stored flag gives the exact choice and moves into the record', () => {
    const loaded = deserialize(PRE_NH05, preview);
    expect(campaignRecord(loaded, BLOCKADE)).toEqual({ status: 'resolved', outcome: 'legacy_unknown', sourceIteration: 1, origin: 'legacy' });
    expect(campaignRecord(loaded, ORDER)).toEqual({ status: 'resolved', outcome: 'gradients', sourceIteration: 1, origin: 'legacy' });
    expect(campaignRecord(loaded, ATMOSPHERE)).toEqual({ status: 'resolved', outcome: 'calm', sourceIteration: 1, origin: 'legacy' });
    expect(campaignRecord(loaded, CEILING)).toBeNull();
    expect(loaded.narrativeFlags).toEqual([]);
    for (const flag of raw.narrativeFlags) expect(holdsNarrativeFlag(loaded, flag, preview)).toBe(true);
    expect(loaded.resolvedDilemmas).toEqual(raw.resolvedDilemmas);
  });

  it('keeps the ending baseline and evidence exactly as the content before the conversion read them', () => {
    const loaded = deserialize(PRE_NH05, preview);
    expect(loaded.campaign.legacyEndingBaseline).toEqual(raw.campaign.legacyEndingBaseline);
    expect(loaded.campaign.operationalEvidence).toEqual(raw.campaign.operationalEvidence);
    const before = beforeNh05();
    expect(endingEvidence(loaded, preview)).toEqual(endingEvidence(deserialize(PRE_NH05, before), before));
  });

  it('completes three obligations for good; after wipes none of the three returns and the fourth still does', () => {
    let state = deserialize(PRE_NH05, preview);
    for (let wipes = 0; wipes < 2; wipes++) {
      state = nextIteration(state);
      expect(OBLIGATIONS.map((id) => obligationReceipt(state, id, preview)?.via ?? null)).toEqual(['original', 'original', 'original', null]);
      for (const id of DONE) expect(comesBack(state, id)).toBe(false);
    }
    expect(comesBack(state, CEILING)).toBe(true);
    const answered = exactReload(play(state, CEILING, 'quartz'));
    const final = finalNode();
    const ended = exactReload(must(unlockNode(exactReload(own(answered, ...final.prerequisites)), final.id, preview)));
    expect(ended.ending).not.toBeNull();
  });

  it('is a no-op on reload and reimport, and never activates twice', () => {
    const loaded = stableThroughReloads(deserialize(PRE_NH05, preview));
    exactReload(loaded);
    expect(serialize(importSave(exportSave(loaded), preview))).toBe(serialize(loaded));
    expect(activateCampaignRules(loaded, preview).ok).toBe(false);
  });

  it('without the conversion the same save gets no record and the crises recur (the test can fail)', () => {
    const before = beforeNh05();
    const loaded = deserialize(PRE_NH05, before);
    for (const id of DONE) expect(campaignRecord(loaded, id)).toBeNull();
    expect(comesBack(nextIteration(loaded, before), BLOCKADE, before)).toBe(true);
  });
});
