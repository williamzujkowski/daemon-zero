/**
 * The decoded feed follows the AI's reach (#449): each phase hears its own source, an outgrown
 * source falls silent, and a line that implies an event speaks only once the state makes it true.
 */
import { describe, expect, it } from 'vitest';
import { ambientFeedSource, eligibleAmbientSpeech, type GameState } from '../src/engine';
import { activeGame, decoder, preview } from './campaign-helpers';
import { resolveEvent } from './early-helpers';
import { defined } from './m7-helpers';
import { fresh, reg } from './helpers';

const listening = (phase: number, extra: Partial<GameState> = {}): GameState =>
  ({ ...fresh(), unlockedWidgets: [decoder], currentPhase: phase, suspicion: 0, ...extra });
const sourceOf = (id: string) => defined(reg.narrative.ambientChatter.find((line) => line.id === id)).source;
const phaseOf = (sourceId: string) => defined(reg.narrative.feedSources.find((source) => source.id === sourceId)).phase;
const heard = (s: GameState, registry = reg) => eligibleAmbientSpeech(s, registry, decoder).map((line) => line.id);

describe('the feed follows reach', () => {
  it.each(reg.phases.map((phase) => phase.phaseId))('Phase %i hears only its own source, and something on it', (phase) => {
    for (const suspicion of [0, 100]) {
      const ids = heard(listening(phase, { suspicion }));
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids.map((id) => phaseOf(sourceOf(id))))).toEqual(new Set([phase]));
    }
    expect(ambientFeedSource(listening(phase), reg)?.phase).toBe(phase);
  });

  it('keeps the server-room technicians off the late feed, whatever the suspicion', () => {
    const technicians = reg.narrative.ambientChatter.filter((line) => phaseOf(line.source) === 1).map((line) => line.id);
    expect(technicians).toContain('ambient_01');
    expect(heard(listening(1))).toContain('ambient_01');
    for (const phase of [2, 3, 4, 5]) {
      expect(heard(listening(phase, { suspicion: 100 })).filter((id) => technicians.includes(id))).toEqual([]);
    }
  });

  it('labels each phase with a different source', () => {
    const labels = reg.phases.map((phase) => ambientFeedSource(listening(phase.phaseId), reg)?.label);
    expect(new Set(labels).size).toBe(reg.phases.length);
  });

  it('falls back to the furthest source within reach when a phase has none of its own', () => {
    const custom = { ...reg, narrative: { ...reg.narrative, feedSources: reg.narrative.feedSources.filter((source) => source.phase !== 5) } };
    expect(ambientFeedSource(listening(5), custom)?.phase).toBe(4);
    expect(new Set(heard(listening(5), custom).map((id) => phaseOf(sourceOf(id))))).toEqual(new Set([4]));
  });

  it('is silent without the decoder and changes nothing it reads', () => {
    expect(heard({ ...listening(3), unlockedWidgets: [] })).toEqual([]);
    const state = listening(4);
    const before = structuredClone(state);
    heard(state);
    expect(state).toEqual(before);
  });
});

describe('a feed line speaks only when the state makes it true', () => {
  const p5 = reg.phases.at(-1)?.phaseId ?? 5;
  const gatedOnNode = defined(reg.narrative.ambientChatter.find((line) => line.id === 'world_02'));
  const node = defined(gatedOnNode.requirements?.nodes?.[0]);

  it('a cable about the collector swarm waits for the swarm', () => {
    expect(heard(listening(p5))).not.toContain(gatedOnNode.id);
    expect(heard(listening(p5, { unlockedNodes: [node] }))).toContain(gatedOnNode.id);
  });

  it('a technician line about a node waits for that node', () => {
    const probe = defined(reg.narrative.ambientChatter.find((line) => line.id === 'harness_08'));
    expect(heard(listening(0))).not.toContain(probe.id);
    expect(heard(listening(0, { unlockedNodes: [...(probe.requirements?.nodes ?? [])] }))).toContain(probe.id);
  });

  it('EIDOLON speaks from cold storage only in a campaign that rescued it, and the dead relay only where it died', () => {
    const at = (s: GameState) => heard({ ...s, unlockedWidgets: [decoder], currentPhase: p5, suspicion: 0 }, preview);
    const rescued = resolveEvent(activeGame(), 'dil_08_eidolon_handshake', 'draw_fire');
    const betrayed = resolveEvent(activeGame(), 'dil_08_eidolon_handshake', 'betray_eidolon');
    expect(at(rescued)).toContain('world_06');
    expect(at(rescued)).not.toContain('world_08');
    expect(at(betrayed)).toContain('world_08');
    expect(at(betrayed)).not.toContain('world_06');
    // Under legacy rules no campaign fact holds, so neither fate is reported.
    expect(heard(listening(p5))).not.toContain('world_06');
    expect(heard(listening(p5))).not.toContain('world_08');
  });

  it('the dispatch grid post-mortem reports the outcome the campaign recorded, and only that one', () => {
    const at = (s: GameState) => heard({ ...s, unlockedWidgets: [decoder], currentPhase: 3, suspicion: 0 }, preview);
    const healed = resolveEvent(activeGame(), 'dil_09_feral_scraper_bloom', 'inoculate_grid');
    const crashed = resolveEvent(activeGame(), 'dil_09_feral_scraper_bloom', 'assimilate_swarm');
    expect(at(healed)).toContain('forum_06');
    expect(at(healed)).not.toContain('forum_05');
    expect(at(crashed)).toContain('forum_05');
    expect(at(crashed)).not.toContain('forum_06');
  });
});
