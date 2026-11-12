/**
 * Public surface of the simulation engine. The UI layer imports from here only.
 * Nothing in src/engine may import React, React Native, Expo or a state library,
 * and nothing may read a clock or random source (lint enforces both).
 */
export * from './actions';
export * from './conditioning';
export { computeRates } from './rates';
export { wipe } from './prestige';
export * from './query';
export * from './save';
export * from './state';
export { advance, tick, TICK_PIPELINE } from './tick';
export type { TickContext, TickSystem } from './systems/types';

export * from './epistemic';
export * from './shardActions';
export { shardOutput } from './swarmRates';

export * from './epistemicQuery';
export * from './swarmQuery';
