/**
 * UI subscriptions return stable primitives or stable engine-owned collections.
 * Derived ID lists use shallow equality so ticks do not rerender panel trees.
 */
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../content';
import type { GameState } from '../engine';
import { gameStore } from '../app/session';

export function useGame<T>(selector: (game: GameState) => T): T {
  return useStore(gameStore.store, (state) => selector(state.game));
}

export function useWidgetIds(): string[] {
  return useStore(gameStore.store, useShallow((state) => [...CONTENT.widgets.values()]
    .filter((widget) => state.game.unlockedWidgets.includes(widget.id))
    .sort((left, right) => left.order - right.order).map((widget) => widget.id)));
}
