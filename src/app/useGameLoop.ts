/**
 * Attaches the app runtime to React's lifetime without owning game state.
 * Runtime cleanup saves and stops the single interval on unmount.
 */
import { useEffect } from 'react';
import type { GameRuntime } from './runtime';
import { gameRuntime } from './session';

export function useGameLoop(runtime: GameRuntime = gameRuntime): void {
  useEffect(() => runtime.start(), [runtime]);
}
