/** Corrupt real manifests to prove every campaign-record content rule catches its mistake (H28). */
import { describe, expect, it } from 'vitest';
import { buildRegistry, CONTENT, RAW_CONTENT, type RawContent } from '../src/content';
import { CONTENT as PREVIEW } from '../src/content/preview';

type Json = Record<string, any>;
const CRYO = 'dil_05_cryo_lab_diversion';
function corrupt(change: (raw: Json) => void): () => unknown {
  const raw = structuredClone(RAW_CONTENT) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
const dilemma = (raw: Json, id: string): Json => raw.dilemmas.dilemmas.find((d: Json) => d.id === id);
const action = (raw: Json, id: string): Json => raw.actions.actions.find((a: Json) => a.id === id);
const record = (raw: Json): Json => raw.narrative.recordedTransmissions[0];

describe('the shipped campaign declarations', () => {
  it('convert exactly cryo, on both channels, with primer and flatten as campaign evidence', () => {
    for (const reg of [CONTENT, PREVIEW]) {
      expect([...reg.campaign.events.keys()]).toEqual([CRYO]);
      expect([...reg.campaign.actions.keys()].sort()).toEqual(['act_epi_flatten', 'act_epi_primer']);
      expect(reg.campaign.events.get(CRYO)?.campaign).toEqual({ eventClass: 'consequential', recurrence: 'once_per_campaign', interruption: 'close' });
    }
  });
});

describe('campaign declarations', () => {
  it('rejects a declaration without an interruption policy or with an unknown class', () => {
    expect(corrupt((raw) => delete dilemma(raw, CRYO).campaign.interruption)).toThrow(/interruption/);
    expect(corrupt((raw) => dilemma(raw, CRYO).campaign.eventClass = 'routine')).toThrow(/eventClass/);
  });

  it('rejects recurrence that contradicts the event class', () => {
    expect(corrupt((raw) => dilemma(raw, CRYO).campaign.recurrence = 'once_per_iteration')).toThrow(/consequential events must recur once per campaign/);
    expect(corrupt((raw) => dilemma(raw, CRYO).campaign.eventClass = 'iteration_qualification')).toThrow(/must recur once per iteration/);
  });

  it('rejects an outcome flag with a second owner', () => {
    expect(corrupt((raw) => action(raw, 'act_epi_signoff').effects.setsNarrativeFlag = 'cryo_samples_lost')).toThrow(/must have one owner/);
  });

  it('rejects outcome flags that are not mutually exclusive', () => {
    expect(corrupt((raw) => raw.swarm.exclusiveNarrativeFlagGroups = [])).toThrow(/must form one exclusive group/);
  });
});

describe('trait evidence on actions', () => {
  it('requires a trait-granting action to declare its evidence lifetime', () => {
    expect(corrupt((raw) => delete action(raw, 'act_epi_primer').evidence)).toThrow(/grants a trait, so it must declare evidence/);
    expect(corrupt((raw) => action(raw, 'act_epi_signoff').evidence = 'operational')).toThrow(/declares evidence but grants no trait/);
    expect(corrupt((raw) => delete action(raw, 'act_epi_primer').maxPurchases)).toThrow(/campaign evidence needs maxPurchases/);
    expect(corrupt((raw) => action(raw, 'act_epi_primer').evidence = 'forever')).toThrow(/evidence/);
  });
});

describe('campaign id compatibility', () => {
  const alias = (from: string, to: string) => ({ from, to, since: 7 });
  it('rejects aliases and retirements that would make a record ambiguous', () => {
    expect(corrupt((raw) => raw.campaign.aliases = [alias(CRYO, 'act_epi_primer')])).toThrow(/old id is still live/);
    expect(corrupt((raw) => raw.campaign.aliases = [alias('dil_old', 'dil_missing')])).toThrow(/is not a campaign event or action/);
    expect(corrupt((raw) => { raw.campaign.aliases = [alias('dil_old', CRYO)]; raw.campaign.retired = ['dil_old']; })).toThrow(/also listed as retired/);
    expect(corrupt((raw) => raw.campaign.retired = [CRYO])).toThrow(/retired id .* is still live/);
    expect(corrupt((raw) => raw.campaign.aliases = [alias('dil_old', CRYO), alias('dil_old', CRYO)])).toThrow(/duplicate alias source/);
    expect(corrupt((raw) => raw.campaign.retired = ['dil_gone', 'dil_gone'])).toThrow(/duplicate retired id/);
    expect(corrupt((raw) => delete raw.campaign.retired)).toThrow(/campaign/);
  });

  it('accepts a well-formed alias and retirement', () => {
    expect(corrupt((raw) => { raw.campaign.aliases = [alias('dil_old', CRYO)]; raw.campaign.retired = ['dil_gone']; })).not.toThrow();
  });
});

describe('campaign outcome requirements', () => {
  it('names a once-per-campaign event and one of its outcomes, or legacy_unknown', () => {
    expect(corrupt((raw) => record(raw).requirements.campaignOutcome = { event: 'dil_00_night_shift', outcome: 'legacy_unknown' })).toThrow(/not a once-per-campaign event/);
    expect(corrupt((raw) => record(raw).requirements.campaignOutcome = { event: CRYO, outcome: 'teleport' })).toThrow(/is not an outcome of/);
    expect(corrupt((raw) => record(raw).requirements.campaignOutcome = { event: CRYO, outcome: 'legacy_unknown' })).not.toThrow();
    expect(corrupt((raw) => record(raw).requirements.campaignOutcome = { event: CRYO, outcome: 'preserve_cryo' })).not.toThrow();
  });
});
