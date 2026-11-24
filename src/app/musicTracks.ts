/**
 * The score manifest (assets/audio/music/tracks.json) decides which track a phase plays. It is
 * parsed strictly at import, like game content, so a malformed entry stops the tests and the
 * app's start instead of playing the wrong file. Public phase identities select the score;
 * hidden narrative flags are never inspected.
 */
import { z } from 'zod';
import manifest from '../../assets/audio/music/tracks.json';

const trackSchema = z.strictObject({
  /** Stable key into `musicSources`; the file behind it can be replaced without touching it. */
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  phase: z.number().int().min(0),
  /** The track's own name, from its PROVENANCE.md. Recorded, not shown: see scoreSession.ts. */
  title: z.string().min(1),
  path: z.string().regex(/^assets\/audio\/music\/[a-z0-9-]+\/[a-z0-9-]+\.mp3$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().positive(),
  duration: z.number().positive(),
  /**
   * Phases with no score of their own that play this one until the maintainer supplies theirs (#486: the Phase 6 Swarm
   * plays Phase 5's). A phase's own entry always wins, so a score dropped in later is heard without editing this list.
   */
  reusedBy: z.array(z.number().int().min(0)).min(1).optional(),
});
export type ScoreTrack = z.infer<typeof trackSchema>;
/** A phase that has a score. Which phases do is the manifest's business, not this type's. */
export type MusicPhase = number;

function repeated(values: readonly (string | number)[]): string | number | undefined {
  return values.find((value, index) => values.indexOf(value) !== index);
}

/**
 * One track per phase, on purpose: with two there would have to be a rule for which one plays,
 * and nobody has decided that rule (docs/SOUNDTRACK.md). Rejecting the second entry is what
 * keeps a dropped-in file from silently never being heard.
 */
export function parseTracks(raw: unknown): readonly ScoreTrack[] {
  const tracks = z.array(trackSchema).parse(raw);
  const columns = [['id', tracks.map((track) => track.id)], ['phase', tracks.map((track) => track.phase)],
    ['path', tracks.map((track) => track.path)]] as const;
  for (const [name, values] of columns) {
    const twice = repeated(values);
    if (twice !== undefined) throw new Error('Score manifest repeats ' + name + ' ' + String(twice));
  }
  // Two scores lent to one phase would need a rule for which plays, as two scores of its own would.
  const lent = repeated(tracks.flatMap((track) => track.reusedBy ?? []));
  if (lent !== undefined) throw new Error('Score manifest lends phase ' + String(lent) + ' two scores');
  return tracks;
}

export const scoreTracks = parseTracks(manifest);

/** The score a phase plays: its own, else the one lent to it (`reusedBy`), else none. */
export function trackFor(phase: number, tracks: readonly ScoreTrack[] = scoreTracks): ScoreTrack | null {
  return tracks.find((track) => track.phase === phase) ?? tracks.find((track) => track.reusedBy?.includes(phase) === true) ?? null;
}

/**
 * The phase whose score plays, when there is one: a phase's own, or the phase that lends it its score (Phase 6 reads 5),
 * so moving between two phases that share a score does not restart it. Null when none plays and the run is silent.
 */
export function musicPhase(phase: number): MusicPhase | null {
  return trackFor(phase)?.phase ?? null;
}
