/** Corrupt the real feed content to prove each feed-source rule catches its mistake (#449). */
import { describe, expect, it } from 'vitest';
import { buildRegistry, RAW_CONTENT, type RawContent } from '../src/content';
import { MIN_FEED_LINES } from '../src/content/integrityFeeds';
type Json = Record<string, any>;

function corrupt(change: (raw: Json) => void): () => unknown {
  const raw = structuredClone(RAW_CONTENT) as Json; change(raw);
  return () => buildRegistry(raw as RawContent);
}
const line = (raw: Json, id: string): Json => raw.narrative.ambientChatter.find((entry: Json) => entry.id === id);
const sourceAt = (raw: Json, phase: number): Json => raw.narrative.feedSources.find((source: Json) => source.phase === phase);

describe('feed sources', () => {
  it('accepts the shipped feed', () => {
    expect(corrupt(() => undefined)).not.toThrow();
  });

  it('requires every line to name a source, and a source that exists', () => {
    expect(corrupt((raw) => { delete line(raw, 'ambient_01').source; })).toThrow();
    expect(corrupt((raw) => { line(raw, 'ambient_01').source = 'pirate_radio'; })).toThrow(/ambient_01: unknown feed source "pirate_radio"/);
  });

  it('requires exactly one source for every phase', () => {
    expect(corrupt((raw) => {
      raw.narrative.feedSources = raw.narrative.feedSources.filter((source: Json) => source.phase !== 3);
    })).toThrow(/phase 3 needs exactly one feed source, has 0/);
    expect(corrupt((raw) => { raw.narrative.feedSources.push({ ...sourceAt(raw, 2), id: 'second_office' }); })).toThrow(/phase 2 needs exactly one feed source, has 2/);
    expect(corrupt((raw) => { sourceAt(raw, 4).phase = 9; })).toThrow(/feed source "\w+": phase 9 is not a phase/);
    expect(corrupt((raw) => { raw.narrative.feedSources.push({ ...sourceAt(raw, 2) }); })).toThrow(/feed: duplicate source id/);
  });

  it('keeps every label to one 360 px line', () => {
    expect(corrupt((raw) => { sourceAt(raw, 5).label = 'WORLD // cables, wires and AI-to-AI comms'; })).toThrow();
  });

  it(`requires every source to carry at least ${String(MIN_FEED_LINES)} lines`, () => {
    expect(corrupt((raw) => {
      const id = sourceAt(raw, 5).id as string;
      const keep = raw.narrative.ambientChatter.filter((entry: Json) => entry.source === id).slice(0, MIN_FEED_LINES - 1);
      raw.narrative.ambientChatter = [...raw.narrative.ambientChatter.filter((entry: Json) => entry.source !== id), ...keep];
    })).toThrow(new RegExp(`feed source "\\w+": needs at least ${String(MIN_FEED_LINES)} lines, has ${String(MIN_FEED_LINES - 1)}`));
  });

  it('requires every source to keep a line with no gate, so its phase is never silent', () => {
    expect(corrupt((raw) => {
      const id = sourceAt(raw, 4).id as string;
      for (const entry of raw.narrative.ambientChatter.filter((each: Json) => each.source === id)) entry.minSuspicion = 10;
    })).toThrow(/feed source "\w+": needs a line with no gate/);
  });

  it('rejects a line whose gate opens only after its source has been outgrown', () => {
    expect(corrupt((raw) => { line(raw, 'ambient_01').requirements = { nodes: ['p3_botnet_mesh'] }; }))
      .toThrow(/ambient_01: its gate opens only in Phase 3, after its source "\w+" \(Phase 1\) is outgrown/);
    expect(corrupt((raw) => { line(raw, 'ambient_05').requirements = { phaseAtLeast: 2 }; }))
      .toThrow(/ambient_05: its gate opens only in Phase 2/);
    expect(corrupt((raw) => { line(raw, 'ambient_04').requirements = { resolvedDilemmas: ['dil_12_investigative_journalist'] }; }))
      .toThrow(/ambient_04: its gate opens only in Phase 4/);
  });

  it('lets an earlier source hear a campaign fact from a later phase, because a wipe does not reset the world', () => {
    expect(corrupt((raw) => { line(raw, 'ambient_04').requirements = { campaignFact: 'swarm_grid_crashed' }; })).not.toThrow();
  });
});
