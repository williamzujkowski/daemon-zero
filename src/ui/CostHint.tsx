import { Text } from './PhaseTheme';
/** Quantized missing amounts explain unaffordable controls without ticking cards. */

import type { Cost } from '../content/schema';
import { costShortfall } from '../engine';
import { costText } from './format';
import { useWindowDimensions } from 'react-native';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { gameStore } from '../app/session';
import { theme } from './theme';
import { isCompactViewport } from './layout';

export default function CostHint({ cost }: { cost: Cost }) {
  const compact = isCompactViewport(useWindowDimensions().width);
  const missing = useStore(gameStore.store, useShallow(({ game }) => {
    const missing = costShortfall(game, cost);
    return { cycles: Math.ceil(missing.cycles), understanding: Math.ceil(missing.understanding),
      capital: Math.ceil(missing.capital), memory: Math.ceil(missing.memory) };
  }));
  const full = costText(missing);
  // 'Need' beside the card's 'Cost' read as a second price when this is the SHORTFALL
  // (costShortfall, quantized so it does not tick). Measured while playing: 'Cost: 40
  // cycles' next to 'Need: 34 cycles' invited a second read. The accessible name keeps the
  // whole sentence; the visible copy says 'short by' so the two numbers cannot be confused.
  return full === 'Free' ? null
    : <Text accessibilityLabel={'Short by ' + full + ' at the current rate'} style={theme.muted}>Short by {costText(missing, compact)}</Text>;
}
