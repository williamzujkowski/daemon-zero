/**
 * Development-only web inspection: validated saves, live engine ticks and render counts.
 * This module is reachable only through compile-time __DEV__ guarded imports.
 */
import { CONTENT } from '../content';
import { importSave, tick } from '../engine';
import type { GameRuntime } from './runtime';
import { snapshotRenderCounts, snapshotNodeProfiles } from './renderCounts';
export { recordNodeRender } from './renderCounts';

export interface DevHost {
  __daemon?: {
    loadSaveCode(code: string): void;
    fastForward(seconds: number): void;
    renderCounts(): Record<string, number>;
    cardProfiles(): ReturnType<typeof snapshotNodeProfiles>;
  };
}

export function installDevTools(runtime: GameRuntime, host: DevHost = globalThis as DevHost): () => void {
  host.__daemon = {
    loadSaveCode(code) {
      const state = importSave(code, CONTENT);
      const result = runtime.dispatch(() => ({ ok: true, state }));
      if (!result.ok) throw new Error(result.reason);
    },
    fastForward(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600) throw new RangeError('Use 0–3600 live seconds.');
      const result = runtime.dispatch((state) => {
        let game = state;
        const step = 1 / CONTENT.balance.tickHz;
        for (let done = 0; done < seconds; done += step) game = tick(game, Math.min(step, seconds - done), CONTENT);
        return { ok: true, state: game };
      });
      if (!result.ok) throw new Error(result.reason);
    },
    renderCounts: snapshotRenderCounts,
    cardProfiles: snapshotNodeProfiles,
  };
  return () => { delete host.__daemon; };
}
