import type { ContentRegistry } from '../../content/registry';
import type { GameState, Rates } from '../state';

export interface TickContext {
  /** Step length in simulated seconds. */
  dt: number;
  reg: ContentRegistry;
  /** Net rates computed once at the start of the tick. */
  rates: Rates;
  /** Offline catch-up: yields are reduced and threats cannot grow. See docs/ARCHITECTURE.md. */
  dormant: boolean;
}

/**
 * One stage of the tick pipeline. Receives a draft it may reassign fields on.
 * Returning 'HALT' stops the pipeline for this tick (used when a wipe replaces the run).
 */
export type TickSystem = (d: GameState, ctx: TickContext) => 'HALT' | undefined;
