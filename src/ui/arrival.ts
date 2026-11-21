/**
 * Whether a panel arrived during play or was already there when the game loaded (#373). A note that appears because
 * of what the player just did is news and opens; the same note found on load is settled and starts folded. The
 * terminal keeps the game as it loaded; a panel asks whether its own condition already held then, once, when it
 * mounts. Render timing would not do: the phone selects its pane after hydration, so a found note mounts late too.
 */
import { useState } from 'react';
import type { GameState } from '../engine';

let loaded: GameState | null = null;

/** Called by the terminal with the game as it hydrated, before play changes it. The first call wins. */
export function markLoaded(game: GameState): void {
  loaded ??= game;
}

/**
 * True if `present` did not hold in the loaded game, so the panel arrived during play. Read once per mount. With no
 * loaded game on record (a panel mounted outside the terminal), it counts as found, so it starts folded.
 */
export function useArrivedDuringPlay(present: (game: GameState) => boolean): boolean {
  const [arrived] = useState(() => loaded !== null && !present(loaded));
  return arrived;
}

/** For tests: back to the state before a load. */
export function resetLoaded(): void {
  loaded = null;
}
