/** Decision information remains on the card even when optional prose is folded away. */
import type { Action } from '../content/schema';
import { CONTENT } from '../content';
import { Text, View } from './PhaseTheme';
import { deltaText } from './format';
import { useGame, useSurveillanceKnown } from './state';
import { theme } from './theme';

function ActionProgress({ action }: { action: Action }) {
  const count = useGame((game) => game.actionCounts[action.id] ?? 0);
  const remaining = useGame((game) => Math.max(0, Math.ceil((game.actionEffectUntil[action.id] ?? 0) - game.simTimeSec)));
  return <>
    {action.maxPurchases !== undefined && <Text testID={'action-count-' + action.id} style={theme.muted}>
      Uses: {count} / {action.maxPurchases} this run</Text>}
    {remaining > 0 && <Text testID={'action-duration-' + action.id} style={theme.muted}>Effect active: {remaining}s remaining</Text>}
  </>;
}

export default function ActionMechanics({ action }: { action: Action }) {
  const known = useSurveillanceKnown();
  const rates = action.tickDelta ? deltaText(action.tickDelta, !known) : '';
  const alternatives = (action.exclusiveWith ?? []).map((id) => CONTENT.actions.get(id)?.label).filter(Boolean);
  return <View testID={'action-mechanics-' + action.id}>
    {rates !== '' && <Text style={theme.muted}>{rates}{action.durationSec === undefined
      ? ' per use, until retraining' : ' for ' + String(action.durationSec) + 's (refreshes; does not stack)'}</Text>}
    {action.cooldownSec > 0 && <Text style={theme.muted}>Reuse delay: {action.cooldownSec}s</Text>}
    {action.effects.removesOldestConditioningMark && <Text style={theme.muted}>Removes the oldest conditioning mark.
      {action.conditioningDiscount !== undefined ? ' Understanding recovery cost: ' + String(Math.round(action.conditioningDiscount * 100)) + '% discount.' : ''}</Text>}
    {alternatives.length > 0 && <Text style={theme.muted}>Excludes: {alternatives.join('; ')}.</Text>}
    {action.effects.setsNarrativeFlag !== undefined && <Text style={theme.muted}>Story consequence survives retraining.</Text>}
    <ActionProgress action={action} />
  </View>;
}
