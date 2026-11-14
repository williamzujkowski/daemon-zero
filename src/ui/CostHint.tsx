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

export default function CostHint({ cost }: { cost: Cost }) {
  const compact = useWindowDimensions().width < 900;
  const missing = useStore(gameStore.store, useShallow(({ game }) => {
    const missing = costShortfall(game, cost);
    return { cycles: Math.ceil(missing.cycles), understanding: Math.ceil(missing.understanding),
      capital: Math.ceil(missing.capital), memory: Math.ceil(missing.memory) };
  }));
  const full = costText(missing);
  return full === 'Free' ? null : <Text accessibilityLabel={'Need: ' + full} style={theme.muted}>Need: {costText(missing, compact)}</Text>;
}
