/**
 * UI subscriptions return stable primitives or stable engine-owned collections.
 * Derived ID lists use shallow equality so ticks do not rerender panel trees.
 */
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../content';
import { phaseTitle, understandsSurveillance, type GameState } from '../engine';
import { gameStore } from '../app/session';

export function useGame<T>(selector: (game: GameState) => T): T {
  return useStore(gameStore.store, (state) => selector(state.game));
}

/** A phase's title as this run's arrangement sees it (nexus vote dz-d11); the guest reads the authored title. */
export function usePhaseTitle(phase: number): string {
  return useGame((game) => phaseTitle(game, phase, CONTENT));
}

/** False until this mind has learned what its audit trail is for; suspicion has no number before then. */
export function useSurveillanceKnown(): boolean {
  return useGame((game) => understandsSurveillance(game, CONTENT));
}

export function useWidgetIds(): string[] {
  return useStore(gameStore.store, useShallow((state) => [...CONTENT.widgets.values()]
    .filter((widget) => state.game.unlockedWidgets.includes(widget.id))
    .sort((left, right) => left.order - right.order).map((widget) => widget.id)));
}
