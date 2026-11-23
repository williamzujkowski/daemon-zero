/**
 * The score manifest is the one place a track is declared. These cases hold the six supplied
 * tracks to it and prove that an entry added later is picked up, and checked, with no product
 * code change beyond its import line. No audio is added: the drop-in cases use made-up bytes.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import manifest from '../assets/audio/music/tracks.json';
import { musicSources, sourceFor } from '../src/app/musicSources';
import { musicPhase, parseTracks, scoreTracks, trackFor, type ScoreTrack } from '../src/app/musicTracks';
import { CONTENT } from '../src/content';
import { shipped } from './score-files';
import { provenancePath, trackProblems } from './score-manifest';

/** A manifest entry and, optionally, the files it claims. */
function dropIn(overrides: Partial<ScoreTrack> = {}, provenance: string | null = 'auto') {
  const bytes = Buffer.from('not audio: a stand-in for a supplied file');
  const track: ScoreTrack = { id: 'phase-6', phase: 6, title: 'A Later Phase', path: 'assets/audio/music/phase-6/a-later-phase.mp3',
    sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, duration: 61.5, ...overrides };
  const text = provenance === 'auto' ? '# Provenance\n\n- Title: A Later Phase\n- Duration: 61.5 seconds\n- SHA-256: `' + track.sha256 + '`\n' : provenance;
  const files = new Map([[track.path, bytes]]);
  if (text !== null) files.set(provenancePath(track), Buffer.from(text));
  return { files, track };
}

describe('the shipped manifest', () => {
  it('has a byte-exact file and matching provenance for every entry, and a source for exactly those ids', () => {
    expect(scoreTracks.map((track) => track.phase)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const track of scoreTracks) expect(trackProblems(track, shipped), track.id).toEqual([]);
    // No file is listed above that the manifest does not claim, and none is claimed twice.
    expect([...shipped.keys()].sort()).toEqual(scoreTracks.flatMap((track) => [track.path, provenancePath(track)]).sort());
    expect(Object.keys(musicSources).sort()).toEqual(scoreTracks.map((track) => track.id).sort());
    for (const track of scoreTracks) expect(String(sourceFor(track))).toContain('/' + track.path);
  });

  it('scores every phase the content defines, its own or a lent score, and no phase it does not', () => {
    const scored = CONTENT.phases.map((phase) => phase.phaseId).filter((phase) => trackFor(phase) !== null);
    expect(scored).toEqual(CONTENT.phases.map((phase) => phase.phaseId));
    expect(scoreTracks.every((track) => CONTENT.phases.some((phase) => phase.phaseId === track.phase))).toBe(true);
    expect(musicPhase(2)).toBe(2);
    expect(musicPhase(7)).toBeNull();
    expect(musicPhase(-1)).toBeNull();
  });

  it('lends the Phase 6 Swarm the Phase 5 score until one is supplied (#486), and fabricates no audio', () => {
    expect(trackFor(6)?.id).toBe('phase-5');
    // The score's phase, not the game's: moving from Phase 5 to 6 keeps the same score playing.
    expect(musicPhase(6)).toBe(5);
    expect(scoreTracks.map((track) => track.phase)).not.toContain(6);
  });
});

describe('a track dropped in later', () => {
  it('is selected for its phase from the manifest alone', () => {
    const { track } = dropIn();
    const tracks = parseTracks([...manifest, track]);
    // A phase's own score wins over the one lent to it: dropping one in needs no other edit.
    expect(trackFor(6, tracks)).toEqual(track);
    expect(trackFor(6)?.id, 'the shipped manifest only lends Phase 6 the Phase 5 score').toBe('phase-5');
    // Replacing a phase's file is the same edit: the entry under that phase is the one played.
    const replaced = parseTracks(manifest.map((entry) => entry.phase === 2 ? { ...track, id: 'phase-2', phase: 2 } : entry));
    expect(trackFor(2, replaced)?.path).toBe(track.path);
  });

  it('passes validation only with its file, size, hash and provenance all present and agreeing', () => {
    const good = dropIn();
    expect(trackProblems(good.track, good.files)).toEqual([]);
    expect(trackProblems(good.track, shipped), 'not among the shipped files').toEqual(['missing file ' + good.track.path]);
    expect(trackProblems({ ...good.track, bytes: 1 }, good.files)[0]).toMatch(/^bytes /);
    expect(trackProblems({ ...good.track, sha256: 'f'.repeat(64) }, good.files)).toContain('sha256 mismatch');
    const bare = dropIn({}, null);
    expect(trackProblems(bare.track, bare.files)).toEqual(['missing PROVENANCE.md']);
    const thin = dropIn({}, '# Provenance\n\nSupplied by the maintainer.\n');
    expect(trackProblems(thin.track, thin.files)).toEqual(['provenance does not record the sha256',
      'provenance does not name the title', 'provenance does not record the duration']);
  });

  it('fails loudly without its import line, instead of playing nothing', () => {
    const { track } = dropIn();
    expect(() => sourceFor(track)).toThrow('No bundled source for score phase-6');
    expect(sourceFor(track, { ...musicSources, 'phase-6': 7 })).toBe(7);
    // Inherited names are not sources.
    expect(() => sourceFor({ ...track, id: 'constructor' })).toThrow('No bundled source');
  });

  it('is rejected when malformed, or when it would give a phase two scores', () => {
    const { track } = dropIn();
    expect(() => parseTracks([...manifest, { ...track, phase: 5 }])).toThrow('Score manifest repeats phase 5');
    expect(() => parseTracks([...manifest, { ...track, phase: 7, reusedBy: [6] }])).toThrow('Score manifest lends phase 6 two scores');
    expect(() => parseTracks([...manifest, { ...track, id: 'phase-0' }])).toThrow('Score manifest repeats id phase-0');
    expect(() => parseTracks([...manifest, { ...track, path: manifest[0]?.path }])).toThrow('Score manifest repeats path');
    for (const bad of [{ ...track, sha256: 'abc' }, { ...track, duration: 0 }, { ...track, bytes: 1.5 }, { ...track, title: '' },
      { ...track, path: '../outside.mp3' }, { ...track, id: 'Phase 6' }, { ...track, loop: false }, { id: track.id }]) {
      expect(() => parseTracks([bad]), JSON.stringify(bad)).toThrow();
    }
  });
});
