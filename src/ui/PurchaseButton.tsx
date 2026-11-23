import { Pressable, Text } from './PhaseTheme';
/**
 * Purchase affordances subscribe independently so changing balances do not
 * rerender their enclosing cards. Engine queries remain the source of permission.
 */

import { CONTENT } from '../content';
import type { Cost } from '../content/schema';
import { canAfford, type ActionResult, type GameState } from '../engine';
import { recordUnlocks } from '../app/unlockPresentation';
import { gameRuntime, gameStore } from '../app/session';
import { selectReady, useGameValue } from '../app/selectors';
import { useGame } from './state';
import { feedback } from '../app/feedback';
import { useReducedMotion } from '../app/useReducedMotion';
import { theme } from './theme';
import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

/** A purchase that cannot be undone asks first, so a stray tap meant for something nearby buys nothing. */
export interface PurchaseConfirm { title: string; detail: string }

export default function PurchaseButton({ id, label, text, cost, allowed, action, confirm }: {
  id: string; label: string; text?: string; cost: Cost; allowed?: (game: GameState) => boolean;
  action: (game: GameState) => ActionResult;
  confirm?: PurchaseConfirm;
}) {
  const reduced = useReducedMotion();
  const [asking, ask] = useState(false);
  const ready = useGameValue(selectReady);
  const enabled = useGame((game) => game.activeDilemmaId === null && game.ending === null &&
    canAfford(game, cost, CONTENT) && (allowed?.(game) ?? true));
  const buy = () => {
    const before = gameStore.store.getState().game.unlockedNodes;
    // The engine re-checks eligibility and price at dispatch, so a confirmation that outlived them buys nothing.
    const result = gameRuntime.dispatch(action);
    if (result.ok) { recordUnlocks(before, result.state.unlockedNodes); void feedback('purchase', reduced); }
  };
  return <>
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label}
      disabled={!ready || !enabled} style={[theme.button, (!ready || !enabled) && theme.disabled]}
      onPress={() => { if (confirm === undefined) buy(); else ask(true); }}>
      <Text style={theme.text}>{text ?? label}</Text>
    </Pressable>
    {asking && confirm !== undefined && <ConfirmDialog id={id} title={confirm.title} detail={confirm.detail}
      cancel={() => { ask(false); }} confirm={() => { ask(false); buy(); }} />}
  </>;
}
