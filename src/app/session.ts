/**
 * Wires the shared app runtime to platform storage, lifecycle and clocks.
 * Construction performs no I/O; the React effect starts hydration and ticking.
 */
import { systemClock } from './clock';
import { getPlatform } from './platform';
import { GameRuntime } from './runtime';
import { createPersistence } from './storage';
import { createGameStore } from './store';

export const gameStore = createGameStore();
const platform = getPlatform();
export const gameRuntime = new GameRuntime(gameStore, createPersistence(platform.storage), platform.lifecycle, systemClock);
