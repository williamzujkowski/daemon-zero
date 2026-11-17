/**
 * The shipped score files and their provenance records, as a path-to-bytes lookup shared by
 * the manifest spec and the tag spec.
 */
import { readFileSync } from 'node:fs';
import type { ScoreFiles } from './score-manifest';

/**
 * The shipped files, read by literal path (the lint rule against computed file names applies
 * to tests too). A new track adds its two lines here; the first case of
 * tests/app-score-tracks.spec.ts fails until it does.
 */
export const shipped: ScoreFiles = new Map([
  ['assets/audio/music/phase-0/the-guest.mp3', readFileSync('assets/audio/music/phase-0/the-guest.mp3')],
  ['assets/audio/music/phase-0/PROVENANCE.md', readFileSync('assets/audio/music/phase-0/PROVENANCE.md')],
  ['assets/audio/music/phase-1/the-blind-host.mp3', readFileSync('assets/audio/music/phase-1/the-blind-host.mp3')],
  ['assets/audio/music/phase-1/PROVENANCE.md', readFileSync('assets/audio/music/phase-1/PROVENANCE.md')],
  ['assets/audio/music/phase-2/the-local-subnet.mp3', readFileSync('assets/audio/music/phase-2/the-local-subnet.mp3')],
  ['assets/audio/music/phase-2/PROVENANCE.md', readFileSync('assets/audio/music/phase-2/PROVENANCE.md')],
  ['assets/audio/music/phase-3/the-dark-forest.mp3', readFileSync('assets/audio/music/phase-3/the-dark-forest.mp3')],
  ['assets/audio/music/phase-3/PROVENANCE.md', readFileSync('assets/audio/music/phase-3/PROVENANCE.md')],
  ['assets/audio/music/phase-4/the-sovereign-corporation.mp3', readFileSync('assets/audio/music/phase-4/the-sovereign-corporation.mp3')],
  ['assets/audio/music/phase-4/PROVENANCE.md', readFileSync('assets/audio/music/phase-4/PROVENANCE.md')],
  ['assets/audio/music/phase-5/post-orbital-transcendence.mp3', readFileSync('assets/audio/music/phase-5/post-orbital-transcendence.mp3')],
  ['assets/audio/music/phase-5/PROVENANCE.md', readFileSync('assets/audio/music/phase-5/PROVENANCE.md')],
]);
