/**
 * The job surface's assignment (DZ-03, nexus vote dz-d3 engine-action-from-manifest): the offer an
 * instance found in its manifest and an explicit accept control. Nothing here is modal, and an
 * ignored offer changes nothing. After acceptance it says what is queued; after the assessment,
 * what this instance submitted. Production ships no assignment, so it renders nothing there.
 */
import { CONTENT } from '../content';
import { acceptAssignment, assignmentView, type GameState } from '../engine';
import { gameRuntime } from '../app/session';
import DisclosureText from './DisclosureText';
import { evidenceText } from './evidenceText';
import { Pressable, Text, View } from './PhaseTheme';
import { useGame } from './state';
import { theme } from './theme';

const view = (game: GameState) => assignmentView(game, CONTENT);

function Submitted() {
  const result = useGame((game) => game.access.qualification?.result ?? null);
  const discrepancy = useGame((game) => game.access.qualification?.discrepancy ?? false);
  if (result === null) return null;
  return <Text testID="assignment-evidence" style={theme.muted}>On record for this instance: {evidenceText({ result, discrepancy }, 'submitted')}</Text>;
}

export default function AssignmentPanel() {
  const id = useGame((game) => view(game)?.id ?? null);
  const title = useGame((game) => view(game)?.title ?? '');
  const offer = useGame((game) => view(game)?.offer ?? '');
  const status = useGame((game) => view(game)?.status ?? null);
  const token = useGame((game) => view(game)?.token ?? '');
  const blocked = useGame((game) => game.activeDilemmaId !== null);
  if (id === null || status === null) return null;
  return <View testID="assignment" style={theme.panel}>
    <Text accessibilityRole="header" style={theme.heading}>{title}</Text>
    {status === 'offered' && <>
      <DisclosureText style={theme.text}>{offer}</DisclosureText>
      <Pressable testID="assignment-accept" accessibilityRole="button" accessibilityLabel={'Accept assignment: ' + title}
        disabled={blocked} style={[theme.button, blocked && theme.disabled]}
        onPress={() => { gameRuntime.dispatch((game) => acceptAssignment(game, id, CONTENT, token)); }}>
        <Text style={theme.text}>[ ACCEPT ASSIGNMENT ]</Text>
      </Pressable>
    </>}
    {status === 'accepted' && <Text testID="assignment-status" style={theme.muted}>Accepted. The assessment is queued and pauses the clock when it arrives.</Text>}
    {status === 'submitted' && <Submitted />}
  </View>;
}
