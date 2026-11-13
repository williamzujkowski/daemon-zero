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
  expect(corrupt((raw) => raw.phases[5].nodes.at(-1).requirements.resolvedDilemmas.push('dil_05_cryo_lab_diversion'))).toThrow(/once-per-lineage dilemma/);
  expect(corrupt((raw) => raw.endings.endings[0].requirements = { resolvedDilemmas: ['dil_05_cryo_lab_diversion'] })).toThrow(/once-per-lineage dilemma/);
  expect(corrupt((raw) => raw.dilemmas.dilemmas.find((d: Json) => d.id === 'dil_p5_01_panacea_paranoia').trigger.resolvedDilemmas = ['dil_05_cryo_lab_diversion'])).toThrow(/once-per-lineage dilemma/);
});

it('requires exclusion guards for exclusive choices and source-matched callback gates', () => {
  expect(corrupt((raw) => delete raw.dilemmas.dilemmas.find((d: Json) => d.id === 'dil_05_cryo_lab_diversion').trigger.forbiddenNarrativeFlags)).toThrow(/durable exclusions/);
  expect(corrupt((raw) => raw.narrative.recordedTransmissions[0].requirements.requiredNarrativeFlag = 'successor_0413_awakened')).toThrow(/not produced by source/);
  expect(corrupt((raw) => delete raw.narrative.recordedTransmissions[0].requirements.phaseAtLeast)).toThrow(/earlier phase/);
});
