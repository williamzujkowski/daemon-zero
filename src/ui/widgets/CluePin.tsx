import { Pressable, Text, View } from '../PhaseTheme';
/**
 * The one disclosed record the player may pin beside the breadcrumb (NARRATIVE-HISTORY N9). Renders
 * nothing under legacy rules or when this instance has seen no record, so production is unchanged.
 */
import { useState } from 'react';
import { CONTENT } from '../../content';
import { clueView, pinClue, pinnableClues, type ClueView } from '../../engine';
import { gameRuntime } from '../../app/session';
import { useGame } from '../state';
import { theme } from '../theme';

const label = (view: ClueView): string => view.title + ' // ' + view.status;

export default function CluePin() {
  const options = useGame((game) => JSON.stringify(pinnableClues(game, CONTENT).flatMap((id) => clueView(game, id, CONTENT) ?? [])));
  const pinned = useGame((game) => {
    const clue = game.campaign.clue;
    const view = clue === null ? null : clueView(game, clue.event, CONTENT);
    return view === null ? null : label(view);
  });
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  // The choice is optional and not timely, so the 9-14 records a real campaign offers fold behind one control (#374).
  const [choosing, choose] = useState(false);
  const views = JSON.parse(options) as ClueView[];
  if (views.length === 0 && pinned === null) return null;
  const count = String(views.length) + (views.length === 1 ? ' record' : ' records');
  return <View testID="clue-pin" style={{ gap: 8 }}>
    <Text style={theme.heading}>Pinned clue</Text>
    <Text style={theme.muted}>One record you have seen can travel with the breadcrumb. It proves nothing and unlocks nothing.</Text>
    <Text testID="clue-pinned" style={theme.text}>Pinned: {pinned ?? 'None'}</Text>
    {views.length > 0 && <Pressable testID="clue-choose" accessibilityRole="button" accessibilityState={{ expanded: choosing }}
      aria-expanded={choosing} accessibilityLabel={'Choose a record to pin (' + count + ' seen)'}
      style={theme.button} onPress={() => { choose(!choosing); }}>
      <Text style={theme.text}>{choosing ? '[ - ] ' : '[ + ] '}Choose a record to pin ({count} seen)</Text>
    </Pressable>}
    {choosing && views.map((view) => <Pressable key={view.event} testID={'clue-pin-' + view.event} accessibilityRole="button"
      accessibilityLabel={'Pin ' + label(view)} disabled={blocked} style={[theme.button, blocked && theme.disabled]}
      onPress={() => { if (gameRuntime.dispatch((game) => pinClue(game, view.event, CONTENT)).ok) choose(false); }}>
      <Text style={theme.text}>[ PIN ] {label(view)}</Text>
    </Pressable>)}
    {pinned !== null && <Pressable testID="clue-clear" accessibilityRole="button" accessibilityLabel="Clear pin: remove the pinned clue"
      disabled={blocked} style={[theme.button, blocked && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => pinClue(game, null, CONTENT)); }}>
      <Text style={theme.text}>[ CLEAR PIN ]</Text>
    </Pressable>}
  </View>;
}
