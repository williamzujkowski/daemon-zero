/**
 * Development-only save editing; every result is validated by the engine codec.
 * Normal gameplay and the final accelerated run never use these mutation shortcuts.
 */
import { CONTENT } from '../content';
import {
  createInitialState, deserialize, exportSave, importSave, isNodeAvailable, serialize,
  unlockNode, wipe, type ActionResult, type GameState, type RawSave,
} from '../engine';
import type { GameRuntime } from './runtime';
import { gameRuntime, gameStore } from './session';

function edited(game: GameState, change: (raw: RawSave) => void): GameState {
  const raw: unknown = JSON.parse(serialize(game));
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('Invalid development save.');
  change(raw as RawSave);
  return deserialize(JSON.stringify(raw), CONTENT);
}

export class DevelopmentActions {
  constructor(private readonly runtime: GameRuntime, private readonly read: () => GameState) {}

  private run(action: (game: GameState) => GameState, allowEnded = false): ActionResult {
    return this.runtime.dispatch((game) => {
      if (typeof __DEV__ === 'undefined' || !__DEV__) return { ok: false, state: game, reason: 'Development tools are unavailable.' };
      if (game.ending !== null && !allowEnded) return { ok: false, state: game, reason: 'This run has ended.' };
      try { return { ok: true, state: action(game) }; }
      catch (error) { return { ok: false, state: game, reason: error instanceof Error ? error.message : 'Development save edit rejected.' }; }
    });
  }

  grant(amount: number): ActionResult {
    return this.run((game) => {
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a finite positive amount.');
      return edited(game, (raw) => {
        raw.cycles = game.cycles + amount; raw.understanding = game.understanding + amount;
        raw.capital = game.capital + amount; raw.memoryCap = game.memoryCap + amount;
      });
    });
  }

  jump(phase: number): ActionResult {
    return this.run(() => {
      if (!CONTENT.phases.some((entry) => entry.phaseId === phase)) throw new Error('Unknown phase.');
      let state = edited(createInitialState(CONTENT), (raw) => {
        raw.cycles = 1e15; raw.understanding = 1e15; raw.capital = 1e15;
        raw.resolvedDilemmas = CONTENT.dilemmas.map((dilemma) => dilemma.id);
      });
      for (const node of CONTENT.nodes.values()) {
        if (node.phaseId >= phase || !isNodeAvailable(state, node)) continue;
        const result = unlockNode(state, node.id, CONTENT);
        if (!result.ok) throw new Error(result.reason);
        state = result.state;
      }
      if (state.currentPhase !== phase) throw new Error('Could not construct the requested review phase.');
      return state;
    }, true);
  }

  forceDilemma(id: string): ActionResult {
    return this.run((game) => {
      if (!CONTENT.dilemmas.some((entry) => entry.id === id)) throw new Error('Unknown dilemma.');
      return edited(game, (raw) => {
        raw.activeDilemmaId = id; raw.resolvedDilemmas = game.resolvedDilemmas.filter((resolved) => resolved !== id);
      });
    });
  }

  forceWipe(): ActionResult {
    return this.run((game) => wipe(game, CONTENT, game.currentPhase >= CONTENT.balance.corporatePhase
      ? CONTENT.narrative.wipeSuspicionCorporate : CONTENT.narrative.wipeSuspicionLocal));
  }

  load(code: string): ActionResult { return this.run(() => importSave(code, CONTENT), true); }
  export(): string { return exportSave(this.read()); }
}

export const developmentActions = new DevelopmentActions(gameRuntime, () => gameStore.store.getState().game);
