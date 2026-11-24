/** Decoded forecasts expose real reserve prices, never future choices or outcomes.
 * Each alternative is a complete cost bundle; unrelated prices are not combined.
 */
import { CONTENT } from '../../content';
import { choiceCost, offeredChoices } from '../../engine';
import { Text } from '../PhaseTheme';
import { costText } from '../format';
import { useComputeUnit, useGame, useSurveillanceKnown } from '../state';
import { theme } from '../theme';

export default function InterruptBudget() {
  const known = useSurveillanceKnown();
  const id = useGame((game) => game.pendingDilemma?.id ?? null);
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === id);
  const unit = useComputeUnit();
  // Only the choices this history will offer: a rescue a shredded rack cannot have is no budget.
  // Priced as the engine will charge them in this phase (#494), not at their listed price.
  const prices = useGame((game) => dilemma ? [...new Set(offeredChoices(game, dilemma, CONTENT)
    .filter((choice) => Object.values(choice.cost).some((value) => value > 0)).map((choice) => costText(choiceCost(game, dilemma, choice, CONTENT), false, unit)))].join(' OR ') : '');
  if (!known || prices === '') return null;
  return <Text testID="interrupt-budget" style={theme.muted}>
    Paid response budgets: {prices}. A free response remains available.
  </Text>;
}
