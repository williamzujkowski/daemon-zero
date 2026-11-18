/**
 * FIXTURE states for the carried clue (#276): the dead-drop owned, the note's omen seen, a clue pinned
 * or not, and the instance wiped during the omen, all through public engine actions on the preview
 * registry (tests/interruption-helpers.ts). Shared by the clue spec and the preview axe audit.
 */
import { pinClue, type GameState } from '../../src/engine';
import { pgrant, preview } from '../campaign-helpers';
import { must, PHASE0, PHASE1, PHASE2 } from '../helpers';
import { caught, note, noteOmen, readShare } from '../interruption-helpers';

export { note };

/** The dead-drop and the share it reads, owned, so a clue can be pinned at all. */
function withDeadDrop(s: GameState): GameState {
  const missing = [...PHASE0, ...PHASE1, ...PHASE2.slice(0, 4)].filter((id) => !s.unlockedNodes.includes(id));
  return readShare(pgrant(s, ...missing));
}

/** The next instance, booted with the note pinned as its clue. */
export function carriedClue(): GameState {
  return caught(must(pinClue(withDeadDrop(noteOmen()), note.id, preview)));
}

/** The next instance after the same wipe with nothing pinned. */
export function noClue(): GameState {
  return caught(withDeadDrop(noteOmen()));
}
