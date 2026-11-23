import { Text } from './PhaseTheme';
/** Quantized missing amounts explain unaffordable controls without ticking cards. */

import { CONTENT } from '../content';
import type { Cost } from '../content/schema';
import { costShortfall, frozenShare } from '../engine';
import { costText } from './format';
import { useWindowDimensions } from 'react-native';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { gameStore } from '../app/session';
import { theme } from './theme';
import { isCompactViewport } from './layout';

/**
 * `lead` names whose shortfall this is when the hint sits beside a control it does not belong to (#376): job 7731's
 * shortfall is its assessment's fullest answer's, not the free ACCEPT's under it. Defaults to the card's own price.
 */
export default function CostHint({ cost, lead = 'Short by', danger = false }: { cost: Cost; lead?: string; danger?: boolean }) {
  const compact = isCompactViewport(useWindowDimensions().width);
  const missing = useStore(gameStore.store, useShallow(({ game }) => {
    const missing = costShortfall(game, cost, CONTENT);
    return { cycles: Math.ceil(missing.cycles), understanding: Math.ceil(missing.understanding),
      capital: Math.ceil(missing.capital), memory: Math.ceil(missing.memory), storage: Math.ceil(missing.storage) };
  }));
  // While capital is short and a freeze holds a share of it (#490), the hint says so: the balance alone would mislead.
  const frozen = useStore(gameStore.store, ({ game }) => (cost.capital > 0 ? frozenShare(game, CONTENT) : 0));
  const full = costText(missing);
  const note = frozen > 0 && missing.capital > 0 ? ` (${String(Math.round(frozen * 100))}% of capital is frozen)` : '';
  // 'Need' beside the card's 'Cost' read as a second price when this is the SHORTFALL
  // (costShortfall, quantized so it does not tick). Measured while playing: 'Cost: 40
  // cycles' next to 'Need: 34 cycles' invited a second read. The accessible name keeps the
  // whole sentence; the visible copy says 'short by' so the two numbers cannot be confused.
  return full === 'Free' ? null
    : <Text accessibilityLabel={lead + ' ' + full + ' at the current rate' + note} style={[theme.muted, danger && theme.danger]}>{lead} {costText(missing, compact)}{note}</Text>;
}
