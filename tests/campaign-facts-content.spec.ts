/**
 * Corrupt the real manifests to prove each NH-03 content rule catches its mistake: declared
 * campaign facts, fact requirements, history-keyed text and the early-event declarations.
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry, RAW_CONTENT, type RawContent } from '../src/content';

type Json = Record<string, any>;
function corrupt(change: (raw: Json) => void): () => unknown {
  const raw = structuredClone(RAW_CONTENT) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
const fact = (raw: Json, id: string): Json => raw.campaign.facts.find((f: Json) => f.id === id);
const dilemma = (raw: Json, id: string): Json => raw.dilemmas.dilemmas.find((d: Json) => d.id === id);
const line = (raw: Json, id: string): Json => raw.narrative.ambientChatter.find((l: Json) => l.id === id);
const record = (raw: Json, id: string): Json => raw.narrative.recordedTransmissions.find((r: Json) => r.id === id);
const echo = (raw: Json, id: string): Json => raw.echoes.echoes.find((e: Json) => e.id === id);

describe('declared campaign facts', () => {
  it('accept the shipped facts', () => {
    expect(corrupt(() => undefined)).not.toThrow();
  });

  it('name a once-per-campaign event and only its outcomes', () => {
    expect(corrupt((raw) => { fact(raw, 'vance_dismissed').event = 'dil_not_shipped'; })).toThrow(/not a once-per-campaign event/);
    expect(corrupt((raw) => { fact(raw, 'vance_dismissed').outcomes = ['cover_her_exit']; })).toThrow(/is not an outcome of "dil_04_admin_vance_secret"/);
    expect(corrupt((raw) => { fact(raw, 'vance_dismissed').outcomes = ['report_vance', 'report_vance']; })).toThrow(/duplicate outcome/);
    expect(corrupt((raw) => { raw.campaign.facts.push({ ...fact(raw, 'vance_dismissed') }); })).toThrow(/duplicate fact id/);
  });

  it('never let an interrupted occurrence prove a chosen branch', () => {
    expect(corrupt((raw) => { fact(raw, 'job_7731_unrecorded').outcomes = ['let_it_fail', 'interrupted']; })).toThrow(/cannot prove a chosen branch/);
  });

  it('let legacy_unknown join exact outcomes only when every choice is covered', () => {
    expect(corrupt((raw) => { fact(raw, 'elena_absent').outcomes = ['cover_her_exit', 'legacy_unknown']; })).toThrow(/covers every choice/);
    expect(corrupt((raw) => { fact(raw, 'vance_dismissed').outcomes = ['report_vance', 'legacy_unknown']; })).toThrow(/covers every choice/);
  });

  it('keep reserved outcome ids out of a campaign event\'s choices', () => {
    expect(corrupt((raw) => { dilemma(raw, 'dil_00_night_shift').choices[1].id = 'interrupted'; })).toThrow(/reserved for campaign records/);
  });
});

describe('fact requirements', () => {
  it('reference a declared fact', () => {
    expect(corrupt((raw) => { line(raw, 'ambient_13').requirements.campaignFact = 'vance_promoted'; })).toThrow(/unknown campaign fact "vance_promoted"/);
    expect(corrupt((raw) => { line(raw, 'ambient_02').requirements.forbidsCampaignFacts = ['vance_promoted']; })).toThrow(/unknown campaign fact "vance_promoted"/);
  });

  it('never require and forbid the same fact', () => {
    expect(corrupt((raw) => { line(raw, 'ambient_13').requirements.forbidsCampaignFacts = ['vance_dismissed']; })).toThrow(/requires and forbids campaign fact/);
  });

  it('gate a receipt on a fact about its own source event, and on one outcome gate only', () => {
    expect(corrupt((raw) => { record(raw, 'record_job7731_unrecorded').requirements.campaignFact = 'vance_dismissed'; })).toThrow(/not about the source event/);
    expect(corrupt((raw) => {
      record(raw, 'record_job7731_unrecorded').requirements.campaignOutcome = { event: 'dil_00_night_shift', outcome: 'let_it_fail' };
    })).toThrow(/needs one outcome gate/);
    expect(corrupt((raw) => { delete record(raw, 'record_job7731_unrecorded').requirements.campaignFact; })).toThrow(/needs one outcome gate/);
  });
});

describe('history-keyed text', () => {
  it('lets a context variant read world history only, and requires it to read some', () => {
    expect(corrupt((raw) => { dilemma(raw, 'dil_note_true').contextVariants[0].requirements.minSuspicion = 10; })).toThrow(/may only read world history, not minSuspicion/);
    expect(corrupt((raw) => { dilemma(raw, 'dil_note_true').contextVariants[0].requirements.nodes = ['p0_note_cache']; })).toThrow(/may only read world history, not nodes/);
    expect(corrupt((raw) => { dilemma(raw, 'dil_note_true').contextVariants[0].requirements = {}; })).toThrow(/needs a history requirement/);
    expect(corrupt((raw) => {
      dilemma(raw, 'dil_note_true').contextVariants[0].requirements.campaignOutcome = { event: 'dil_note_bait', outcome: 'use_the_gap' };
    })).toThrow(/is not an outcome of "dil_note_bait"/);
  });

  it('lets an echo read world history only', () => {
    expect(corrupt((raw) => { echo(raw, 'echo_audio').requirements.minUnderstanding = 5; })).toThrow(/echo "echo_audio": history-keyed text may only read world history/);
    expect(corrupt((raw) => { echo(raw, 'echo_audio_vance_gone').requirements.campaignFact = 'vance_fired'; })).toThrow(/unknown campaign fact/);
  });
});

describe('the early-event declarations', () => {
  it('keep the deferring events resumable and the closing ones free of resume text', () => {
    expect(corrupt((raw) => { delete dilemma(raw, 'dil_04_admin_vance_secret').campaign.lead; })).toThrow(/needs reorientation and lead/);
    expect(corrupt((raw) => { delete dilemma(raw, 'dil_note_true').campaign.reorientation; })).toThrow(/needs reorientation and lead/);
    expect(corrupt((raw) => { dilemma(raw, 'dil_00_night_shift').campaign.interruption = 'defer'; })).toThrow(/needs reorientation and lead/);
    expect(corrupt((raw) => { dilemma(raw, 'dil_02_whistleblower_tech').campaign.lead = 'Elena is waiting by the stairwell.'; })).toThrow(/closing event cannot declare/);
  });

  it('keep every early event a once-per-campaign record', () => {
    expect(corrupt((raw) => { dilemma(raw, 'dil_03_silicon_fever').campaign.recurrence = 'once_per_iteration'; })).toThrow(/must recur once per campaign/);
    expect(corrupt((raw) => { delete dilemma(raw, 'dil_00_night_shift').campaign; })).toThrow(/not a once-per-campaign event/);
  });
});
