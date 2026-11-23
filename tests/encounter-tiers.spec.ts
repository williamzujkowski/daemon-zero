/**
 * Lesser minds scale with the player's phase (#492, docs/SCALE.md "Other minds scale with the player"): the wild pool is
 * the current phase's tier, an earlier tier retires, a pending arrival from a retired tier lapses with its own line,
 * and a cohort harnessed from a retired tier keeps working, outclassed, and stays free to release.
 */
import { describe, expect, it } from 'vitest';
import { computeRates, releaseShard, resolveWildEncounter, shardEntryView, tick, unlockNode, wildEncounterView,
  type GameState } from '../src/engine';
import { evaluateShardMutationsAndEncounters } from '../src/engine/systems/evaluateSwarmAndEpistemic';
import { defined } from './m7-helpers';
import { grant, must, PHASE0, PHASE1, PHASE2, reasonOf, reg, rich, withoutDilemmas } from './helpers';

const wild = reg.swarm.wildShardEncounters;
const tierOf = (id: string | null): number => defined(wild.find((entry) => entry.id === id)).tier;
const tiers = [...new Set(wild.map((entry) => entry.tier))].sort((a, b) => a - b);
const ready = (phase: number): GameState => ({ ...withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1)), currentPhase: phase,
  simTimeSec: 1000, nextEncounterAtSec: 1000 });

function stage(s: GameState): GameState {
  const d = structuredClone(s);
  evaluateShardMutationsAndEncounters(d, { dt: .1, dormant: false, reg, rates: computeRates(s, reg) });
  return d;
}

/** The arrivals a player at `phase` meets, consuming each as it comes, from a given rotation index. */
function arrivals(phase: number, count: number, index = 0): string[] {
  let s: GameState = { ...ready(phase), encounterSequenceIndex: index };
  const seen: string[] = [];
  for (let i = 0; i < count; i++) {
    s = stage({ ...s, simTimeSec: s.nextEncounterAtSec });
    seen.push(defined(s.pendingWildEncounterId));
    s = must(resolveWildEncounter(s, 'CONSUME', reg));
  }
  return seen;
}

describe('the eligible pool follows the current phase', () => {
  it('authors a tier for every phase from the first small models to the last phase in content', () => {
    const last = Math.max(...reg.phases.map((phase) => phase.phaseId));
    expect(tiers).toEqual(Array.from({ length: last - 1 }, (_, index) => index + 2));
  });

  it.each(tiers)('a Phase %i player meets only Phase %i minds, every one of them in turn', (phase) => {
    const own = wild.filter((entry) => entry.tier === phase).map((entry) => entry.id);
    const seen = arrivals(phase, own.length * 2);
    expect(seen.every((id) => tierOf(id) === phase)).toBe(true);
    expect(new Set(seen)).toEqual(new Set(own));
  });

  it('retires every earlier tier: no Phase 2 small model arrives once Phase 3 is reached', () => {
    for (const phase of tiers.slice(1)) expect(arrivals(phase, 8).some((id) => tierOf(id) < phase)).toBe(false);
  });

  it('keeps the deterministic round-robin: the same index gives the same arrivals, and each arrival advances it', () => {
    expect(arrivals(3, 6, 5)).toEqual(arrivals(3, 6, 5));
    const own = wild.filter((entry) => entry.tier === 3);
    const first = stage(ready(3));
    expect(first.pendingWildEncounterId).toBe(defined(own[0]).id);
    expect(first.encounterSequenceIndex).toBe(1);
    expect(stage({ ...ready(3), encounterSequenceIndex: 1 }).pendingWildEncounterId).toBe(defined(own[1 % own.length]).id);
  });
});

describe('a pending arrival from an earlier tier lapses honestly when the phase advances', () => {
  const lex = defined(wild.find((entry) => entry.tier === 2));

  it('lapses at the purchase that crosses into the next phase, with its own line, and nothing is paid or granted', () => {
    const gate = defined(PHASE2.at(-1));
    const before = { ...withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1, ...PHASE2.slice(0, -1))), pendingWildEncounterId: lex.id };
    expect(wildEncounterView(before, reg)?.id).toBe(lex.id);
    const after = must(unlockNode(before, gate, reg));
    expect(after.currentPhase).toBe(3);
    expect(after.pendingWildEncounterId).toBeNull();
    expect(after.logs.map((entry) => entry.text)).toContain(lex.lapseLog);
    expect(after.understanding).toBe(before.understanding - defined(reg.nodes.get(gate)).cost.understanding);
    expect(after.activeShards).toEqual(before.activeShards);
  });

  it('lapses on the next tick when a save already holds one (an older save at a later phase), then the new tier arrives', () => {
    const loaded = { ...ready(3), pendingWildEncounterId: lex.id };
    const next = tick(loaded, .1, reg);
    const texts = next.logs.map((entry) => entry.text);
    expect(texts).toContain(lex.lapseLog);
    expect(tierOf(next.pendingWildEncounterId)).toBe(3);
    expect(texts.indexOf(lex.lapseLog)).toBeGreaterThan(texts.indexOf(defined(wild.find((e) => e.id === next.pendingWildEncounterId)).description));
  });

  it('lapses even while the host is dormant, so an offline catch-up never leaves a retired arrival pending', () => {
    const d = structuredClone({ ...ready(4), pendingWildEncounterId: lex.id });
    evaluateShardMutationsAndEncounters(d, { dt: 60, dormant: true, reg, rates: computeRates(d, reg) });
    expect(d.pendingWildEncounterId).toBeNull();
    expect(d.logs[0]?.text).toBe(lex.lapseLog);
  });

  it('is never offered meanwhile: the view hides it and both answers refuse it', () => {
    const stale = { ...ready(3), pendingWildEncounterId: lex.id };
    expect(wildEncounterView(stale, reg)).toBeNull();
    expect(reasonOf(resolveWildEncounter(stale, 'CONSUME', reg))).toBe('no available encounter');
    expect(reasonOf(resolveWildEncounter(stale, 'HARNESS', reg))).toBe('no available encounter');
  });

  it('leaves an arrival of the current tier, and the authorized channel, alone', () => {
    const current = defined(wild.find((entry) => entry.tier === 3));
    const s = { ...ready(3), pendingWildEncounterId: current.id };
    expect(stage(s).pendingWildEncounterId).toBe(current.id);
    expect(stage(s).logs).toEqual(s.logs);
  });
});

describe('a cohort harnessed from a retired tier keeps working, outclassed, and stays free to release', () => {
  const lex = defined(wild.find((entry) => entry.tier === 2));

  it('keeps its output after the phase advances, says it is outclassed, and RELEASE returns its memory for free', () => {
    const bound = must(resolveWildEncounter({ ...ready(2), pendingWildEncounterId: lex.id }, 'HARNESS', reg));
    const view = defined(shardEntryView(bound, lex.templateId, reg));
    expect(view.outclassed).toBeNull();
    const later = { ...bound, currentPhase: 4 };
    const outclassed = defined(shardEntryView(later, lex.templateId, reg));
    expect(outclassed.output).toBe(view.output);
    expect(outclassed.outclassed).toBe(reg.swarm.copy.outclassed.replace('{tier}', '2').replace('{phase}', '4'));
    const template = defined(reg.swarm.playerSwarmTemplates.find((entry) => entry.id === lex.templateId));
    expect(computeRates(later, reg).understandingPerSec).toBeGreaterThanOrEqual(template.tickDelta.understandingPerSec);
    const released = must(releaseShard(later, lex.templateId, reg));
    expect(released.activeShards[lex.templateId]).toBeUndefined();
    expect(released.memoryUsed).toBe(later.memoryUsed - template.cost.memory);
    expect(released.cycles).toBe(later.cycles);
    expect(released.understanding).toBe(later.understanding);
  });

  it('never calls a forked cohort outclassed: only a tier a wild arrival came from retires', () => {
    const forkable = defined(reg.swarm.playerSwarmTemplates.find((entry) => entry.forkable && !wild.some((e) => e.templateId === entry.id)));
    const s = { ...ready(5), activeShards: { [forkable.id]: { templateId: forkable.id, count: 1, drift: 0, quirkId: null,
      autonomyMode: 'STANDARD' as const, memoryAllocatedBytes: forkable.cost.memory } } };
    expect(shardEntryView(s, forkable.id, reg)?.outclassed).toBeNull();
  });
});
