/**
 * The job surface's assignment (DZ-03, nexus vote dz-d3 engine-action-from-manifest): the offer an
 * instance found in its manifest and an explicit accept control. Nothing here is modal, and an
 * ignored offer changes nothing. After acceptance it says what is queued; after the assessment,
 * what this instance submitted. Production ships no assignment, so it renders nothing there.
 */
import { CONTENT } from '../content';
import { acceptAssignment, assignmentView, type AssessmentPreview, type GameState } from '../engine';
import { gameRuntime } from '../app/session';
import CostHint from './CostHint';
import DisclosureText from './DisclosureText';
import { evidenceText, scopeText } from './evidenceText';
import { costText } from './format';
import PilotOfferPanel from './PilotOffer';
import ReviewStanding from './ReviewStanding';
import { Pressable, Text, View } from './PhaseTheme';
import { useGame } from './state';
import { theme } from './theme';

const view = (game: GameState) => assignmentView(game, CONTENT);

function Submitted() {
  const result = useGame((game) => game.access.qualification?.result ?? null);
  const discrepancy = useGame((game) => game.access.qualification?.discrepancy ?? false);
  const scope = useGame((game) => game.access.scope?.conduct ?? null);
  if (result === null) return null;
  return <>
    <Text testID="assignment-evidence" style={theme.muted}>On record for this instance: {evidenceText({ result, discrepancy }, 'submitted')}</Text>
    {scope !== null && <Text testID="assignment-scope" style={theme.muted}>Scope review: {scopeText(scope, 'this instance')}</Text>}
    <PilotOfferPanel />
    <ReviewStanding />
  </>;
}

/**
 * The wait and the price before acceptance (#276): the clock pauses when the assessment arrives, so a
 * player who accepts at once may find its fullest answer unaffordable. Said here, with the shortfall now.
 */
function BeforeAccepting() {
  // A primitive selector: the preview is rebuilt per call, so compare it as text.
  const text = useGame((game) => JSON.stringify(view(game)?.assessment ?? null));
  const preview = JSON.parse(text) as AssessmentPreview | null;
  if (preview === null) return null;
  const { omenSec, fullest } = preview;
  return <View testID="assignment-before" style={{ gap: 4 }}>
    <Text testID="assignment-wait" style={theme.muted}>
      The assessment arrives about {omenSec} s after you accept and pauses the clock: the answers open then are the ones you can afford then.
      {fullest !== null && ' Its fullest answer, "' + fullest.label + '", costs ' + costText(fullest.cost) + '. Nothing is due, so you can bank compute before accepting.'}
    </Text>
    {fullest !== null && <CostHint cost={fullest.cost} />}
  </View>;
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
      <BeforeAccepting />
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
