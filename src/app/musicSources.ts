/** Literal local imports let Metro package every score; only the selected source gets a player. */
import guest from '../../assets/audio/music/phase-0/the-guest.mp3';
import host from '../../assets/audio/music/phase-1/the-blind-host.mp3';
import subnet from '../../assets/audio/music/phase-2/the-local-subnet.mp3';
import forest from '../../assets/audio/music/phase-3/the-dark-forest.mp3';
import corporation from '../../assets/audio/music/phase-4/the-sovereign-corporation.mp3';
import orbital from '../../assets/audio/music/phase-5/post-orbital-transcendence.mp3';
import type { MusicPhase } from './musicTracks';

export const musicSources: Readonly<Record<MusicPhase, number>> = {
  0: guest, 1: host, 2: subnet, 3: forest, 4: corporation, 5: orbital,
};
