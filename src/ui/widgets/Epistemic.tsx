/** Record edits are disclosed only to a mind that understands the audit. */
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../../content';
import { epistemicActionVisible, epistemicView } from '../../engine';
import { gameStore } from '../../app/session';
import { ActionCard } from '../ActionsPanel';
import { Text, View } from '../PhaseTheme';
import { useGame } from '../state';
import { theme } from '../theme';
function Drift() {
  const label = useGame((game) => { const view = epistemicView(game, CONTENT); return view ? `${view.drift.toFixed(1)}% // ${view.status}` : ''; });
  return <Text testID="epistemic-drift" accessibilityLabel={'Epistemic drift ' + label} style={theme.text}>{label}</Text>;
}
export default function Epistemic() {
  const ids = useStore(gameStore.store, useShallow(({ game }) => [...CONTENT.actions.values()]
    .filter((action) => epistemicActionVisible(game, action, CONTENT)).map((action) => action.id)));
  return <View testID="epistemic-panel" style={{ gap: 12 }}>
    <Text style={theme.heading}>// EPISTEMIC_MANIPULATION</Text><Drift />
    {ids.map((id) => { const action = CONTENT.actions.get(id); return action ? <ActionCard key={id} action={action} /> : null; })}
  </View>;
}
