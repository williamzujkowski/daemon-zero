import { Text, View } from './PhaseTheme';
import DisclosureText from './DisclosureText';
/** Action groups, prices and consequences come from the content registry. */

import { memo, useEffect } from 'react';
import { Platform } from 'react-native';
import { recordNodeRender } from '../app/renderCounts';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { gameStore } from '../app/session';
import { CONTENT } from '../content';
import type { Action } from '../content/schema';
import { actionAvailable, actionCost, actionExhausted, performAction } from '../engine';
import { costText } from './format';
import Effects from './Effects';
import PurchaseButton from './PurchaseButton';
import RequirementHint from './RequirementHint';
import { useGame } from './state';
import { theme } from './theme';
import CostHint from './CostHint';
import { permanentlyBlocked } from './purchaseVisibility';

function Cooldown({ id }: { id: string }) {
  const seconds = useGame((game) => Math.max(0, Math.ceil((game.cooldowns[id] ?? 0) - game.simTimeSec)));
  return seconds > 0 ? <Text testID={'action-cooldown-' + id} style={theme.muted}>Cooldown: {seconds}s</Text> : null;
}

export const ActionCard = memo(function ActionCard({ action }: { action: Action }) {
  useEffect(() => { if (typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'web') recordNodeRender('action:' + action.id); });
  const cost = useStore(gameStore.store, useShallow(({ game }) => actionCost(game, action, CONTENT)));
  return <View testID={'action-card-' + action.id} style={theme.panel}>
    <Text style={theme.heading}>{action.label}</Text>
    <DisclosureText style={theme.text}>{action.description}</DisclosureText>
    <Text testID={'action-cost-' + action.id} style={theme.muted}>Cost: {costText(cost)}</Text>
    <CostHint cost={cost} />
    <Effects effects={action.effects} />
    <RequirementHint requirements={action.requirements} />
    <Cooldown id={action.id} />
    <PurchaseButton id={'action-' + action.id} label={action.label} cost={cost}
      allowed={(game) => actionAvailable(game, action, CONTENT) && (game.cooldowns[action.id] ?? 0) <= game.simTimeSec}
      action={(game) => performAction(game, action.id, CONTENT)} />
  </View>;
});

export default function ActionsPanel({ group }: { group: string }) {
  const ids = useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.actions.values()]
    .filter((action) => action.group === group && !action.requirements.requiresSurveillance && !actionExhausted(game, action) &&
      !permanentlyBlocked(game, action.requirements))
    .map((action) => action.id)));
  return <View testID={'actions-group-' + group} style={{ gap: 12 }}>
    {ids.map((id) => { const action = CONTENT.actions.get(id); return action ? <ActionCard key={id} action={action} /> : null; })}
  </View>;
}
