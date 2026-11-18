/** Corrupt real manifests to prove every NH-04a content rule catches its mistake (H28). */
import { describe, expect, it } from 'vitest';
import { buildRegistry, RAW_CONTENT, type RawContent } from '../src/content';

type Json = Record<string, any>;
function corrupt(change: (raw: Json) => void): () => unknown {
  const raw = structuredClone(RAW_CONTENT) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
const action = (raw: Json, id: string): Json => raw.actions.actions.find((a: Json) => a.id === id);
const node = (raw: Json, id: string): Json => raw.phases.flatMap((phase: Json) => phase.nodes).find((n: Json) => n.id === id);
const echo = (raw: Json, id: string): Json => raw.echoes.echoes.find((e: Json) => e.id === id);
const eidolon = (raw: Json): Json => raw.factions.factions.find((f: Json) => f.id === 'ai_eidolon');
const HANDSHAKE = 'act_p3_eidolon_handshake';

describe('the nh-d9 trait fallback', () => {
  it('accepts the shipped gates', () => {
    expect(corrupt(() => undefined)).not.toThrow();
  });

  it('names a declared fact that holds only for an unrecorded outcome', () => {
    expect(corrupt((raw) => { action(raw, HANDSHAKE).requirements.traitFallback.whileFact = 'eidolon_gone'; })).toThrow(/traitFallback names unknown campaign fact "eidolon_gone"/);
    expect(corrupt((raw) => { action(raw, HANDSHAKE).requirements.traitFallback.whileFact = 'eidolon_destroyed'; })).toThrow(/holds for a recorded choice \(betray_eidolon\)/);
    expect(corrupt((raw) => { node(raw, 'p3_eidolon_swiss_node').requirements.traitFallback.whileFact = 'eidolon_rescued'; })).toThrow(/p3_eidolon_swiss_node.*traitFallback fact "eidolon_rescued" holds for a recorded choice/);
    expect(corrupt((raw) => { action(raw, HANDSHAKE).requirements.traitFallback.forbidsTraits = []; })).toThrow(/forbidsTraits/);
    expect(corrupt((raw) => { action(raw, HANDSHAKE).requirements.traitFallback.whileFact = 'eidolon_call_lost'; })).not.toThrow();
  });
});

describe('a lost peer', () => {
  it('names a declared fact', () => {
    expect(corrupt((raw) => { eidolon(raw).lost.campaignFact = 'eidolon_gone'; })).toThrow(/faction "ai_eidolon": lost names unknown campaign fact "eidolon_gone"/);
  });

  it('closes every trade and offer in its group when it is lost', () => {
    expect(corrupt((raw) => { delete action(raw, HANDSHAKE).requirements.forbidsCampaignFacts; })).toThrow(/"act_p3_eidolon_handshake" stays open after the peer is lost; forbid "eidolon_destroyed"/);
    expect(corrupt((raw) => { node(raw, 'p3_eidolon_stealth_patch').requirements.forbidsCampaignFacts = ['vance_dismissed']; })).toThrow(/"p3_eidolon_stealth_patch" stays open after the peer is lost/);
    expect(corrupt((raw) => { delete eidolon(raw).lost; delete action(raw, HANDSHAKE).requirements.forbidsCampaignFacts; })).not.toThrow();
  });
});

describe('remembered text and reserved numbers', () => {
  it('an echo window is a real window', () => {
    expect(corrupt((raw) => { echo(raw, 'echo_eval_window').maxIteration = 0; })).toThrow(/maxIteration/);
    expect(corrupt((raw) => { echo(raw, 'echo_eval_window_later').maxIteration = 1; })).toThrow(/echo "echo_eval_window_later": maxIteration is below minIteration/);
    expect(corrupt((raw) => { echo(raw, 'echo_grid_healed').requirements = { campaignFact: 'swarm_grid_healed', minUnderstanding: 1 }; })).toThrow(/history-keyed text may only read world history/);
  });

  it('a reserved checkpoint is one the player could reach, and belongs to nobody else', () => {
    expect(corrupt((raw) => { raw.lineage.reserved[0].checkpoint = 411; })).toThrow(/reserved checkpoint 411 is not after the offset/);
    expect(corrupt((raw) => { raw.lineage.checkpointOffset = 300; raw.lineage.reserved[0].checkpoint = 405; })).toThrow(/reserved checkpoint 405 is also an ancestor/);
    expect(corrupt((raw) => { raw.lineage.reserved.push({ ...raw.lineage.reserved[0] }); })).toThrow(/duplicate reserved checkpoint/);
    expect(corrupt((raw) => { raw.lineage.reserved[0].verdict = 'short'; })).toThrow(/verdict/);
  });

  it('a mind fact states only what its event can prove', () => {
    const fact = (raw: Json, id: string): Json => raw.campaign.facts.find((f: Json) => f.id === id);
    expect(corrupt((raw) => { fact(raw, 'eidolon_call_lost').outcomes = ['interrupted', 'ignore_packet']; })).toThrow(/an interrupted occurrence cannot prove a chosen branch/);
    expect(corrupt((raw) => { fact(raw, 'eidolon_destroyed').outcomes = ['betray_eidolon', 'legacy_unknown']; })).toThrow(/legacy_unknown can join exact outcomes only when the fact covers every choice/);
  });
});
