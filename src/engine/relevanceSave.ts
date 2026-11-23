/**
 * Saves and the standing stance (#536). No earlier build had a relevance threshold, so no save has taken a stance or
 * changed one: the step writes the empty record as literals a later content change cannot alter. Self-contained: it
 * writes only its own field, so it can be renumbered past another step (retaliation #537, the Swarm #486) unchanged.
 */
import type { RawSave } from './save';

export function migrateRelevance(save: RawSave): RawSave {
  return { ...save, relevance: { stance: null, record: [] } };
}
