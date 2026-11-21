/**
 * Whether a panel arrived during play or was already there when the game loaded (#373). A note that appears because
 * of what the player just did is news and opens; the same note found on load is settled and starts folded. The
 * terminal records the game as it loaded under a key that changes with every load: the restore revision (a new run or
 * an import) and the iteration (a reboot). A panel mounting before that record exists for the current key is mounting
 * with the load, so it was found. Render timing alone would not do: the phone selects its pane after hydration.
 */
import { useState } from 'react';
import { gameStore } from '../app/session';
import type { GameState } from '../engine';

let loaded: { key: string; game: GameState } | null = null;

/** The current load: replaced by a new run, an import (restore revision) or a reboot (iteration). */
export function loadKey(revision: number, iteration: number): string {
  return String(revision) + ':' + String(iteration);
}

/** Called by the terminal after the first commit of each load; the first call for a key wins. */
export function markLoaded(game: GameState, key: string): void {
  if (loaded?.key !== key) loaded = { key, game };
}

/** True if `present` did not hold in the game as this load began, so the panel arrived during play. Read once per mount. */
export function useArrivedDuringPlay(present: (game: GameState) => boolean): boolean {
  const [arrived] = useState(() => {
    const { restoreRevision, game } = gameStore.store.getState();
    return loaded !== null && loaded.key === loadKey(restoreRevision, game.iteration) && !present(loaded.game);
  });
  return arrived;
}

/** For tests: back to the state before any load. */
export function resetLoaded(): void {
  loaded = null;
}
