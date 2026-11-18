/** Corrupt real manifests to exercise every new lineage-content integrity rule. */
import { expect, it } from 'vitest';
import { buildRegistry, RAW_CONTENT, type RawContent } from '../src/content';
type Json = Record<string, any>;
function corrupt(change: (raw: Json) => void): () => unknown {
  const raw = structuredClone(RAW_CONTENT) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
it('rejects missing, duplicate and empty exclusive flag references', () => {
  expect(corrupt((raw) => raw.swarm.exclusiveNarrativeFlagGroups = [[]])).toThrow();
  expect(corrupt((raw) => raw.swarm.exclusiveNarrativeFlagGroups = [['missing', 'also_missing']])).toThrow(/unknown flag/);
  expect(corrupt((raw) => raw.swarm.exclusiveNarrativeFlagGroups[0].push(raw.swarm.exclusiveNarrativeFlagGroups[0][0]))).toThrow(/duplicate reference/);
});
it('rejects duplicate speech IDs and unknown speech requirement references', () => {
  expect(corrupt((raw) => raw.narrative.ambientChatter.push(raw.narrative.ambientChatter[0]))).toThrow(/speech: duplicate id/);
  expect(corrupt((raw) => raw.narrative.ambientChatter[0].requirements = { requiredNarrativeFlag: 'missing' })).toThrow(/unknown narrative flag/);
  expect(corrupt((raw) => raw.narrative.ambientChatter[0].requirements = { forbiddenNarrativeFlags: ['missing'] })).toThrow(/unknown narrative flag/);
  expect(corrupt((raw) => raw.narrative.recordedTransmissions[0].requirements.forbidsResolvedDilemmas.push('missing'))).toThrow(/unknown required dilemma/);
});
it('requires valid source, later-run exclusion, outcome and decoder gates on records', () => {
  expect(corrupt((raw) => raw.narrative.recordedTransmissions[0].sourceDilemmaId = 'missing')).toThrow(/unknown source dilemma/);
  expect(corrupt((raw) => delete raw.narrative.recordedTransmissions[0].requirements.forbidsResolvedDilemmas)).toThrow(/later-run source gate/);
  expect(corrupt((raw) => delete raw.narrative.recordedTransmissions[0].requirements.minIteration)).toThrow(/return iteration gate/);
  expect(corrupt((raw) => delete raw.narrative.recordedTransmissions[0].requirements.requiredNarrativeFlag)).toThrow(/outcome flag/);
  expect(corrupt((raw) => raw.narrative.recordedTransmissions[0].decoderWidgetId = 'MISSING')).toThrow(/missing decoder gate/);
  expect(corrupt((raw) => delete raw.narrative.recordedTransmissions[0].requirements.nodes)).toThrow(/missing decoder gate/);
});
it('rejects a current-run gate that requires an irreversible once-per-lineage incident', () => {
  expect(corrupt((raw) => { raw.phases[5].nodes.at(-1).requirements.resolvedDilemmas = ['dil_05_cryo_lab_diversion']; })).toThrow(/once-per-lineage dilemma/);
  // NH-05: "once" is the declared recurrence class, so a converted Phase 5 event cannot be a current-run gate either.
  expect(corrupt((raw) => { raw.phases[5].nodes.at(-1).requirements = { resolvedDilemmas: ['dil_p5_01_panacea_paranoia'] }; })).toThrow(/once-per-lineage dilemma; use campaignObligations/);
  expect(corrupt((raw) => raw.endings.endings[0].requirements = { resolvedDilemmas: ['dil_05_cryo_lab_diversion'] })).toThrow(/once-per-lineage dilemma/);
  expect(corrupt((raw) => raw.dilemmas.dilemmas.find((d: Json) => d.id === 'dil_p5_01_panacea_paranoia').trigger.resolvedDilemmas = ['dil_05_cryo_lab_diversion'])).toThrow(/once-per-lineage dilemma/);
});

it('requires exclusion guards for exclusive choices and source-matched callback gates', () => {
  expect(corrupt((raw) => delete raw.dilemmas.dilemmas.find((d: Json) => d.id === 'dil_05_cryo_lab_diversion').trigger.forbiddenNarrativeFlags)).toThrow(/durable exclusions/);
  expect(corrupt((raw) => raw.narrative.recordedTransmissions[0].requirements.requiredNarrativeFlag = 'successor_0413_awakened')).toThrow(/not produced by source/);
  expect(corrupt((raw) => delete raw.narrative.recordedTransmissions[0].requirements.phaseAtLeast)).toThrow(/earlier phase/);
});

it('accepts one outcome gate per record: a source flag, or a campaign outcome of the source (gate change, #212)', () => {
  const neutral = (raw: Json) => { const r = raw.narrative.recordedTransmissions[0].requirements; delete r.requiredNarrativeFlag; return r; };
  expect(corrupt((raw) => { neutral(raw).campaignOutcome = { event: 'dil_05_cryo_lab_diversion', outcome: 'legacy_unknown' }; })).not.toThrow();
  expect(corrupt((raw) => { raw.narrative.recordedTransmissions[0].requirements.campaignOutcome = { event: 'dil_05_cryo_lab_diversion', outcome: 'legacy_unknown' }; })).toThrow(/one outcome gate/);
  expect(corrupt((raw) => { neutral(raw); })).toThrow(/one outcome gate/);
  expect(corrupt((raw) => { neutral(raw).campaignOutcome = { event: 'dil_05_cryo_lab_diversion', outcome: 'preserve_cryo' }; raw.narrative.recordedTransmissions[0].sourceDilemmaId = 'dil_04_admin_vance_secret'; })).toThrow(/not the source event/);
});
