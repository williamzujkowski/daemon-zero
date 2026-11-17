/**
 * Literal local imports let Metro package every score; only the selected source gets a player.
 * Metro resolves assets at build time, so this table cannot be derived from the manifest: a new
 * track needs its one line here, keyed by its manifest id, and a test fails until the two agree.
 */
import guest from '../../assets/audio/music/phase-0/the-guest.mp3';
import host from '../../assets/audio/music/phase-1/the-blind-host.mp3';
import subnet from '../../assets/audio/music/phase-2/the-local-subnet.mp3';
import forest from '../../assets/audio/music/phase-3/the-dark-forest.mp3';
import corporation from '../../assets/audio/music/phase-4/the-sovereign-corporation.mp3';
import orbital from '../../assets/audio/music/phase-5/post-orbital-transcendence.mp3';
import type { ScoreTrack } from './musicTracks';

/** Manifest track id -> bundled asset. */
export const musicSources: Readonly<Record<string, number>> = {
  'phase-0': guest, 'phase-1': host, 'phase-2': subnet, 'phase-3': forest, 'phase-4': corporation, 'phase-5': orbital,
};

export function sourceFor(track: ScoreTrack, sources: Readonly<Record<string, number>> = musicSources): number {
  // Own keys only, as for voice clips: an id such as `constructor` must not find a source.
  const source = Object.hasOwn(sources, track.id) ? sources[track.id] : undefined;
  if (source === undefined) throw new Error('No bundled source for score ' + track.id);
  return source;
}
