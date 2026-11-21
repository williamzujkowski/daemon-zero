/**
 * The ending's hint at what is left to earn (#379). Unearned titles stay hidden (UI-SPEC: an unearned title
 * would name a scene the run may never have met), so the hint counts the rest by kind and names nothing.
 */
import type { DistinctionKind } from '../engine';

const KIND_TEXT: Readonly<Record<DistinctionKind, string>> = {
  CONDUCT: 'for how the lineage plays',
  OUTCOME: 'for how scenes it meets turn out',
};

/** "Still to earn: 1 for how the lineage plays, 4 for how scenes it meets turn out. ..." */
export function remainingText(counts: Readonly<Record<DistinctionKind, number>>): string {
  const parts = (['CONDUCT', 'OUTCOME'] as const).filter((kind) => counts[kind] > 0)
    .map((kind) => String(counts[kind]) + ' ' + KIND_TEXT[kind]);
  if (parts.length === 0) return 'Every distinction is earned.';
  return 'Still to earn: ' + parts.join(', ') + '. Titles appear once earned, since some name scenes a lineage may never meet.';
}
