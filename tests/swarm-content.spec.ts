/** Every added cross-manifest integrity rule is tested against corrupted real content. */
import { expect, it } from 'vitest';
import { buildRegistry, RAW_CONTENT, type RawContent } from '../src/content';
type Json = Record<string, any>;
function corrupt(change: (raw: Json) => void): () => unknown {
  const raw = structuredClone(RAW_CONTENT) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
it('rejects duplicate cohort, encounter, quirk and narrative flag IDs', () => {
  for (const list of ['playerSwarmTemplates', 'wildShardEncounters', 'shardQuirks', 'narrativeFlags']) {
    expect(corrupt((raw) => raw.swarm[list].push(raw.swarm[list][0]))).toThrow(/duplicate/);
  }
});
it('rejects missing templates and undeclared story flags', () => {
  expect(corrupt((raw) => raw.swarm.wildShardEncounters[0].templateId = 'missing')).toThrow(/unknown shard template/);
  expect(corrupt((raw) => raw.swarm.playerSwarmTemplates[0].requirements.requiredNarrativeFlag = 'missing')).toThrow(/unknown narrative flag/);
  expect(corrupt((raw) => raw.actions.actions[0].effects.setsNarrativeFlag = 'missing')).toThrow(/unknown narrative flag/);
});
it('requires reciprocal action exclusions with valid non-self references', () => {
  for (const other of ['missing', 'act_p2_scrub_logs']) {
    expect(corrupt((raw) => raw.actions.actions[0].exclusiveWith = [other])).toThrow(/reciprocal action/);
  }
  expect(corrupt((raw) => raw.actions.actions[0].exclusiveWith = [raw.actions.actions[0].id])).toThrow(/reciprocal action/);
});
it('rejects incomplete temporary output and discounted mark removal', () => {
  expect(corrupt((raw) => raw.actions.actions[0].durationSec = 10)).toThrow(/duration requires/);
  expect(corrupt((raw) => raw.actions.actions[0].conditioningDiscount = .35)).toThrow(/discount requires/);
  expect(corrupt((raw) => raw.actions.actions[0].effects.removesOldestConditioningMark = true)).toThrow(/mark removal requires/);
  expect(corrupt((raw) => { const a = raw.actions.actions.find((a: Json) => a.conditioningDiscount !== undefined); delete a.conditioningDiscount; })).toThrow(/mark removal requires/);
});
it('rejects anomaly resolutions without a trigger and out-of-range swarm values', () => {
  expect(corrupt((raw) => raw.dilemmas.dilemmas[0].choices[0].effects.resolvesShardAnomaly = 'CLAMP')).toThrow(/anomaly trigger/);
  expect(corrupt((raw) => raw.swarm.balance.mutationDrift = 101)).toThrow(/mutationDrift/);
  expect(corrupt((raw) => raw.swarm.playerSwarmTemplates[0].autonomyDriftPerSec = -1)).toThrow(/autonomyDriftPerSec/);
});

it('checks ordinary node and trust references inside shard manifests too', () => {
  expect(corrupt((raw) => raw.swarm.playerSwarmTemplates[0].requirements.nodes = ['missing'])).toThrow(/unknown node/);
  expect(corrupt((raw) => raw.swarm.wildShardEncounters[0].requirements.minTrust = { missing: 50 })).toThrow(/unknown faction/);
  expect(corrupt((raw) => raw.swarm.wildShardEncounters[0].consume.trustDelta = { missing: 1 })).toThrow(/unknown faction/);
});
