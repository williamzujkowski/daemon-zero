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
  return tracks;
}

export const scoreTracks = parseTracks(manifest);

export function trackFor(phase: number, tracks: readonly ScoreTrack[] = scoreTracks): ScoreTrack | null {
  return tracks.find((track) => track.phase === phase) ?? null;
}

/** The phase, when it has a score; null when it has none and the run plays in silence. */
export function musicPhase(phase: number): MusicPhase | null {
  return trackFor(phase)?.phase ?? null;
}
