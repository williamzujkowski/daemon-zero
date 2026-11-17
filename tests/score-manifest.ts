/**
 * What a score manifest entry must have before it may ship: the file, at the recorded size
 * and hash, and a PROVENANCE.md beside it that names the same hash, the track's title and its
 * duration. Shared by the spec that checks the real manifest and the one that proves a new
 * entry would be held to the same standard. It reads through `files`, a path-to-bytes lookup,
 * so both the shipped assets and a made-up entry go through the same checks.
 */
import { createHash } from 'node:crypto';
import type { ScoreTrack } from '../src/app/musicTracks';

export type ScoreFiles = ReadonlyMap<string, Buffer>;

export function provenancePath(track: ScoreTrack): string {
  return track.path.slice(0, track.path.lastIndexOf('/')) + '/PROVENANCE.md';
}

export function trackProblems(track: ScoreTrack, files: ScoreFiles): string[] {
  const data = files.get(track.path);
  if (!data) return ['missing file ' + track.path];
  const problems: string[] = [];
  if (data.length !== track.bytes) problems.push('bytes ' + String(data.length) + ' != ' + String(track.bytes));
  if (createHash('sha256').update(data).digest('hex') !== track.sha256) problems.push('sha256 mismatch');
  const text = files.get(provenancePath(track))?.toString('utf8');
  if (text === undefined) return [...problems, 'missing PROVENANCE.md'];
  if (!text.includes(track.sha256)) problems.push('provenance does not record the sha256');
  if (!text.includes(track.title)) problems.push('provenance does not name the title');
  if (!text.includes('Duration: ' + String(track.duration) + ' seconds')) problems.push('provenance does not record the duration');
  return problems;
}
