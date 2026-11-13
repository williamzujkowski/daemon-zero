/** Decoded forecasts expose real reserve prices, never future choices or outcomes.
 * Each alternative is a complete cost bundle; unrelated prices are not combined.
 */
import { CONTENT } from '../../content';
import { Text } from '../PhaseTheme';
import { costText } from '../format';
import { useGame, useSurveillanceKnown } from '../state';
import { theme } from '../theme';

export default function InterruptBudget() {
  const known = useSurveillanceKnown();
  const id = useGame((game) => game.pendingDilemma?.id ?? null);
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === id);
  const prices = [...new Set(dilemma?.choices.filter((choice) => Object.values(choice.cost).some((value) => value > 0))
    .map((choice) => costText(choice.cost)))];
  if (!known || prices.length === 0) return null;
  return <Text testID="interrupt-budget" style={theme.muted}>
    Paid response budgets: {prices.join(' OR ')}. A free response remains available.
  </Text>;
}
