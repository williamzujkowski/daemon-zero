/** Action groups, prices and consequences come from the content registry. */
import { Text, View } from 'react-native';
import { CONTENT } from '../content';
import type { Action } from '../content/schema';
import { meetsRequirements, performAction } from '../engine';
import { costText } from './format';
import Effects from './Effects';
import PurchaseButton from './PurchaseButton';
import RequirementHint from './RequirementHint';
import { useGame } from './state';
import { theme } from './theme';

function ActionCard({ action }: { action: Action }) {
  const cooldown = useGame((game) => Math.max(0, Math.ceil((game.cooldowns[action.id] ?? 0) - game.simTimeSec)));
  return <View testID={'action-card-' + action.id} style={theme.panel}>
    <Text style={theme.heading}>{action.label}</Text>
    <Text style={theme.text}>{action.description}</Text>
    <Text testID={'action-cost-' + action.id} style={theme.muted}>Cost: {costText(action.cost)}</Text>
    <Effects effects={action.effects} />
    <RequirementHint requirements={action.requirements} />
    {cooldown > 0 && <Text testID={'action-cooldown-' + action.id} style={theme.muted}>Cooldown: {cooldown}s</Text>}
    <PurchaseButton id={'action-' + action.id} label={action.label} cost={action.cost}
      allowed={(game) => meetsRequirements(game, action.requirements) && (game.cooldowns[action.id] ?? 0) <= game.simTimeSec}
      action={(game) => performAction(game, action.id, CONTENT)} />
  </View>;
}

export default function ActionsPanel({ group }: { group: string }) {
  return <View testID={'actions-group-' + group} style={{ gap: 12 }}>
    {[...CONTENT.actions.values()].filter((action) => action.group === group).map((action) => <ActionCard key={action.id} action={action} />)}
  </View>;
}
