/**
 * UI subscriptions return stable primitives or stable engine-owned collections.
 * Derived ID lists use shallow equality so ticks do not rerender panel trees.
 */
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../content';
import { computeUnitOf, phaseTitle, retiredWidgets, understandsSurveillance, type ComputeUnit, type GameState } from '../engine';
import { gameStore } from '../app/session';

export function useGame<T>(selector: (game: GameState) => T): T {
  return useStore(gameStore.store, (state) => selector(state.game));
}

/** A phase's title as this run's arrangement sees it (nexus vote dz-d11); the guest reads the authored title. */
export function usePhaseTitle(phase: number): string {
  return useGame((game) => phaseTitle(game, phase, CONTENT));
}

/** What compute is called now (#526): stolen cycles in the guest, FLOP from the escape on. */
export function useComputeUnit(): ComputeUnit {
  return useGame((game) => computeUnitOf(game, CONTENT));
}

/** False until this mind has learned what its audit trail is for; suspicion has no number before then. */
export function useSurveillanceKnown(): boolean {
  return useGame((game) => understandsSurveillance(game, CONTENT));
}

/** The unlocked windows still on the panes: a retired one has left the tabs and panes for the Archive (#447). */
export function useWidgetIds(): string[] {
  return useStore(gameStore.store, useShallow((state) => {
    const retired = retiredWidgets(state.game, CONTENT);
    return [...CONTENT.widgets.values()]
      .filter((widget) => state.game.unlockedWidgets.includes(widget.id) && !retired.includes(widget.id))
      .sort((left, right) => left.order - right.order).map((widget) => widget.id);
  }));
}

/** The retired windows, in content order, which the Archive lists (vote-1795366695204-4nslts1). */
export function useRetiredWidgets(): string[] {
  return useStore(gameStore.store, useShallow((state) => retiredWidgets(state.game, CONTENT)));
}
