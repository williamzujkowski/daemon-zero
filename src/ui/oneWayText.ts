/**
 * Says when a purchase cannot be undone (#372). Read from the node's own effects, so any node that ends the
 * run or opens a later phase is marked, and none else. The current phase only ever rises within a run
 * (actions.ts: currentPhase = max), so a phase opener ahead of it really has no way back; a wipe starts a
 * new iteration, not this run again.
 */
import type { RegistryNode } from '../content/registry';

/** The line for a one-way purchase, or null for an ordinary one. */
export function oneWayText(node: RegistryNode, currentPhase: number): string | null {
  if (node.effects.forcesEnding !== undefined || node.effects.triggersVictory === true) return 'Cannot be undone: this ends the run.';
  const opens = node.effects.unlocksPhase;
  if (opens !== undefined && opens > currentPhase) return 'Cannot be undone: this run moves on to Phase ' + String(opens) + ' and cannot go back.';
  return null;
}

/** The second line of a confirmation whose action no control can reverse. Restoring an exported backup is the one way back. */
export const NO_UNDO_TEXT = 'This cannot be undone: only a backup exported before this can restore the run.';
