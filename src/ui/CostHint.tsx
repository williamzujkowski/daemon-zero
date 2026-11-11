import { Text } from './PhaseTheme';
/** Quantized missing amounts explain unaffordable controls without ticking cards. */

import type { Cost } from '../content/schema';
import { costShortfall } from '../engine';
import { costText } from './format';
import { useGame } from './state';
import { theme } from './theme';

export default function CostHint({ cost }: { cost: Cost }) {
  const text = useGame((game) => {
    const missing = costShortfall(game, cost);
    return costText({ cycles: Math.ceil(missing.cycles), understanding: Math.ceil(missing.understanding),
      capital: Math.ceil(missing.capital), memory: Math.ceil(missing.memory) });
  });
  return text === 'Free' ? null : <Text style={theme.muted}>Need: {text}</Text>;
}
