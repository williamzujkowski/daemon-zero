/**
 * Saves and the standing stance (#536). No earlier build had a relevance threshold, so no save has taken a stance or
 * changed one: the step writes the empty record and zero counts as literals a later content change cannot alter. Self-contained: it
 * writes only its own field, so it can be renumbered past another step (it moved from v27 to v29 past retaliation, #537, and merged log lines, #541, unchanged).
 */
import type { RawSave } from './save';

export function migrateRelevance(save: RawSave): RawSave {
  return { ...save, relevance: { stance: null, record: [], paidMoves: { leftLoop: 0, returnedToLoop: 0 } } };
}
