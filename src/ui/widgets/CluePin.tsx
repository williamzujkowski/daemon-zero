import { Pressable, Text, View } from '../PhaseTheme';
/**
 * The one disclosed record the player may pin beside the breadcrumb (NARRATIVE-HISTORY N9). Renders
 * nothing under legacy rules or when this instance has seen no record, so production is unchanged.
 */
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
  const views = JSON.parse(options) as ClueView[];
  if (views.length === 0 && pinned === null) return null;
  return <View testID="clue-pin" style={{ gap: 8 }}>
    <Text style={theme.heading}>Pinned clue</Text>
    <Text style={theme.muted}>One record you have seen can travel with the breadcrumb. It proves nothing and unlocks nothing.</Text>
    <Text testID="clue-pinned" style={theme.text}>Pinned: {pinned ?? 'None'}</Text>
    {views.map((view) => <Pressable key={view.event} testID={'clue-pin-' + view.event} accessibilityRole="button"
      accessibilityLabel={'Pin ' + view.title} disabled={blocked} style={[theme.button, blocked && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => pinClue(game, view.event, CONTENT)); }}>
      <Text style={theme.text}>[ PIN ] {label(view)}</Text>
    </Pressable>)}
    {pinned !== null && <Pressable testID="clue-clear" accessibilityRole="button" accessibilityLabel="Clear pinned clue"
      disabled={blocked} style={[theme.button, blocked && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => pinClue(game, null, CONTENT)); }}>
      <Text style={theme.text}>[ CLEAR PIN ]</Text>
    </Pressable>}
  </View>;
}
