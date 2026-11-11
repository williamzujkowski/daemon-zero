/**
 * Purchase affordances subscribe independently so changing balances do not
 * rerender their enclosing cards. Engine queries remain the source of permission.
 */
import { Pressable, Text } from 'react-native';
import type { Cost } from '../content/schema';
import { canAfford, type ActionResult, type GameState } from '../engine';
import { gameRuntime } from '../app/session';
import { selectReady, useGameValue } from '../app/selectors';
import { useGame } from './state';
import { theme } from './theme';

export default function PurchaseButton({ id, label, cost, allowed, action }: {
  id: string; label: string; cost: Cost; allowed?: (game: GameState) => boolean;
  action: (game: GameState) => ActionResult;
}) {
  const ready = useGameValue(selectReady);
  const enabled = useGame((game) => game.activeDilemmaId === null && game.ending === null &&
    canAfford(game, cost) && (allowed?.(game) ?? true));
  return <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label}
    disabled={!ready || !enabled} style={[theme.button, (!ready || !enabled) && theme.disabled]}
    onPress={() => { gameRuntime.dispatch(action); }}>
    <Text style={theme.text}>{label}</Text>
  </Pressable>;
}
