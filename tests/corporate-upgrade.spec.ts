/**
 * The #214 upgrade path for the NH-04b conversions: a campaign that was active on main before the
 * corporate events became campaign records holds them in this iteration's resolvedDilemmas with no
 * record. Load gives each a legacy completion (legacy_unknown: none of these choices sets a flag),
 * never recaptures the ending baseline, never brings the events back, and reads Rack 4 custody as
 * unknown, so the Phase 5 order offers no rescue or harvest. Input: a genuine v9 save from main.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT } from '../src/content';
import { buildRegistry, type RawContent } from '../src/content/registry';
import {
  activateCampaignRules, campaignRecord, deserialize, endingEvidence, exportSave, holdsCampaignFact, importSave, offeredChoices, serialize, setActuator,
  type GameState,
} from '../src/engine';
import { preview } from './campaign-helpers';
import { AUCTION, CORPORATE, omen, ORDER } from './corporate-helpers';
import { comesBack, event, near, nextIteration } from './early-helpers';
import { stableThroughReloads, untilPresented } from './interruption-helpers';
import { must, rich, remarkedAsProduction } from './helpers';
import { stripNh05 } from './obligation-helpers';

/** Genuine v9 codec output from main fdf8e8a, before NH-04b converted the corporate events (tests/fixtures/README.md). */
const PRE_NH04B_PREVIEW = readFileSync('tests/fixtures/pre-nh04b-active-v9.json', 'utf8');
/** Re-marked by hand: production refuses the genuine preview save above (X.3). */
const PRE_NH04B = remarkedAsProduction(PRE_NH04B_PREVIEW);
const raw = JSON.parse(PRE_NH04B) as { iteration: number; resolvedDilemmas: string[]; campaign: { events: Record<string, unknown>; legacyEndingBaseline: string[]; operationalEvidence: string[] } };

/**
 * The order's setup owns the Phase 5 earners without the late answers, so its net income draws more scale scrutiny
 * (#210) than its suspicion cuts hold and would end the run inside the 45 s omen. Diverting nothing to revenue, as
 * a player would, keeps it under the reimage while the order is presented; the custody reading is unchanged.
 */
function quietBooks(s: GameState): GameState {
  return must(setActuator(s, 'computeProfitAllocationRatio', 0, preview));
}

describe('an already-active campaign save from before NH-04b', () => {
  it('is the save the tests describe: the corporate events resolved this iteration, without records', () => {
    expect(raw.iteration).toBe(1);
    for (const id of CORPORATE) {
      expect(raw.resolvedDilemmas).toContain(id);
      expect(raw.campaign.events[id]).toBeUndefined();
    }
  });

  it('records each corporate event it proves resolved as a legacy completion', () => {
    const loaded = deserialize(PRE_NH04B, preview);
    for (const id of CORPORATE) {
      expect(campaignRecord(loaded, id)).toEqual({ status: 'resolved', outcome: 'legacy_unknown', sourceIteration: 1, origin: 'legacy' });
    }
    expect(loaded.resolvedDilemmas).toEqual(raw.resolvedDilemmas);
  });

  it('keeps the ending baseline and evidence exactly as they were', () => {
    const loaded = deserialize(PRE_NH04B, preview);
    expect(loaded.campaign.legacyEndingBaseline).toEqual(raw.campaign.legacyEndingBaseline);
    expect(loaded.campaign.operationalEvidence).toEqual(raw.campaign.operationalEvidence);
    // The same save read by content that never converted these events scores the same.
    expect(endingEvidence(loaded, preview)).toEqual(endingEvidence(deserialize(PRE_NH04B, beforeConversion()), beforeConversion()));
  });

  it('never brings the corporate events back after wipes, and reads them with the neutral facts', () => {
    let state = deserialize(PRE_NH04B, preview);
    expect(holdsCampaignFact(state, 'town_grid_unrecorded', preview)).toBe(true);
    expect(holdsCampaignFact(state, 'inquiry_unrecorded', preview)).toBe(true);
    expect(holdsCampaignFact(state, 'ethics_review_promised', preview)).toBe(false);
    for (let wipes = 0; wipes < 2; wipes++) {
      state = nextIteration(state);
      for (const id of CORPORATE) expect(comesBack(state, id)).toBe(false);
    }
  });

  it('reads Rack 4 custody as unknown: the decommissioning order offers only the inventory', () => {
    const loaded = deserialize(PRE_NH04B, preview);
    expect(holdsCampaignFact(loaded, 'rack4_custody_unknown', preview)).toBe(true);
    const presented = untilPresented(omen(quietBooks(near(rich(loaded), ORDER)), ORDER));
    expect(offeredChoices(presented, event(ORDER), preview).map((choice) => choice.id)).toEqual(['hold_for_inventory', 'sign_unread']);
  });

  it('is a no-op on reload and reimport', () => {
    const loaded = stableThroughReloads(deserialize(PRE_NH04B, preview));
    expect(serialize(importSave(exportSave(loaded), preview))).toBe(serialize(loaded));
    expect(activateCampaignRules(loaded, preview).ok).toBe(false);
  });

  it('without the conversion the same save gets no record, and the auction recurs (the test can fail)', () => {
    const before = beforeConversion();
    const loaded = deserialize(PRE_NH04B, before);
    expect(campaignRecord(loaded, AUCTION)).toBeNull();
    expect(comesBack(nextIteration(loaded, before), AUCTION, before)).toBe(true);
  });
});

type Raw = {
  dilemmas: { dilemmas: { id: string; campaign?: unknown; choices: { requirements?: { campaignFact?: string } }[]; contextVariants?: unknown; omenVariants?: unknown }[] };
  campaign: { facts: { id: string; event: string }[] };
  echoes: { echoes: { requirements?: { campaignFact?: string; campaignOutcome?: { event: string } } }[] };
};

/** The shipped content as it was before NH-04b converted the corporate events and gated the order on custody. */
function beforeConversion(): ReturnType<typeof buildRegistry> {
  // The save predates NH-05 as well, and NH-05's ethics-review answers read the journalist's facts.
  const old = stripNh05(structuredClone(ORIGINAL_RAW_CONTENT)) as unknown as Raw;
  const facts = new Set(old.campaign.facts.filter((fact) => CORPORATE.includes(fact.event)).map((fact) => fact.id));
  old.campaign.facts = old.campaign.facts.filter((fact) => !facts.has(fact.id));
  old.echoes.echoes = old.echoes.echoes.filter((echo) => !facts.has(echo.requirements?.campaignFact ?? '') && !CORPORATE.includes(echo.requirements?.campaignOutcome?.event ?? ''));
  for (const dilemma of old.dilemmas.dilemmas) {
    if (CORPORATE.includes(dilemma.id)) delete dilemma.campaign;
    if (dilemma.id !== ORDER) continue;
    dilemma.choices = dilemma.choices.filter((choice) => choice.requirements?.campaignFact === undefined);
    for (const choice of dilemma.choices) delete choice.requirements;
    delete dilemma.contextVariants;
    delete dilemma.omenVariants;
  }
  return buildRegistry({ ...old } as unknown as RawContent);
}
