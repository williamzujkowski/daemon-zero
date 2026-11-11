/**
 * Attaches the app runtime to React's lifetime without owning game state.
 * Runtime cleanup saves and stops the single interval on unmount.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { GameRuntime } from './runtime';
import { gameRuntime } from './session';

export function useGameLoop(runtime: GameRuntime = gameRuntime): void {
  useEffect(() => {
    const stop = runtime.start();
    let disposed = false;
    let removeTools = () => { /* Production and native have no web development hook. */ };
    if (typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'web') {
      void import('./devTools').then(({ installDevTools }) => {
        if (!disposed) removeTools = installDevTools(runtime);
      });
    }
    return () => { disposed = true; removeTools(); stop(); };
  }, [runtime]);
}
