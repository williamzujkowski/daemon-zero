import { Pressable, Text } from './PhaseTheme';
/**
 * Purchase affordances subscribe independently so changing balances do not
 * rerender their enclosing cards. Engine queries remain the source of permission.
 */

import type { Cost } from '../content/schema';
import { canAfford, type ActionResult, type GameState } from '../engine';
import { recordUnlocks } from '../app/unlockPresentation';
import { gameRuntime, gameStore } from '../app/session';
import { selectReady, useGameValue } from '../app/selectors';
import { useGame } from './state';
import { feedback } from '../app/feedback';
import { useReducedMotion } from '../app/useReducedMotion';
import { theme } from './theme';

export default function PurchaseButton({ id, label, text, cost, allowed, action }: {
  id: string; label: string; text?: string; cost: Cost; allowed?: (game: GameState) => boolean;
  action: (game: GameState) => ActionResult;
}) {
  const reduced = useReducedMotion();
  const ready = useGameValue(selectReady);
  const enabled = useGame((game) => game.activeDilemmaId === null && game.ending === null &&
    canAfford(game, cost) && (allowed?.(game) ?? true));
  return <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label}
    disabled={!ready || !enabled} style={[theme.button, (!ready || !enabled) && theme.disabled]}
    onPress={() => {
      const before = gameStore.store.getState().game.unlockedNodes;
      const result = gameRuntime.dispatch(action);
      if (result.ok) { recordUnlocks(before, result.state.unlockedNodes); void feedback('purchase', reduced); }
    }}>
    <Text style={theme.text}>{text ?? label}</Text>
  </Pressable>;
}
