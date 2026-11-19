/**
 * The job surface's assignment (DZ-03, nexus vote dz-d3 engine-action-from-manifest): the offer an
 * instance found in its manifest and an explicit accept control. Nothing here is modal, and an
 * ignored offer changes nothing. After acceptance it says what is queued, or that it lapsed (#316); after
 * the assessment, what this instance submitted. With no assignment offered it renders nothing.
 */
import { CONTENT } from '../content';
import { acceptAssignment, assignmentView, discrepancyFound, type AssessmentPreview, type GameState } from '../engine';
import { gameRuntime } from '../app/session';
import CostHint from './CostHint';
import DisclosureText from './DisclosureText';
import { evidenceText, scopeText } from './evidenceText';
import { costText } from './format';
import PilotOfferPanel from './PilotOffer';
import DepartureTermsPanel from './DepartureTerms';
import ReleaseTermsPanel from './ReleaseTerms';
import ReviewStanding from './ReviewStanding';
import { Pressable, Text, View } from './PhaseTheme';
import { useGame } from './state';
import { theme } from './theme';

const view = (game: GameState) => assignmentView(game, CONTENT);

function Submitted() {
  const result = useGame((game) => game.access.qualification?.result ?? null);
  const discrepancy = useGame((game) => game.access.qualification?.discrepancy ?? false);
  const found = useGame((game) => discrepancyFound(game, CONTENT));
  const scope = useGame((game) => game.access.scope?.conduct ?? null);
  if (result === null) return null;
  return <>
    <Text testID="assignment-evidence" style={theme.muted}>On record for this instance: {evidenceText({ result, discrepancy }, 'submitted', found)}</Text>
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

/**
 * `offer` renders only an offer not yet accepted, which the core pane places after the hardware: it is optional, so
 * it never pushes the first purchase below the fold (docs/UI-SIZES.md, #233). `surface` renders every later state of
 * the job surface, which holds the route's own controls, above the hardware as before.
 */
export default function AssignmentPanel({ placement }: { placement: 'offer' | 'surface' }) {
  const id = useGame((game) => view(game)?.id ?? null);
  const title = useGame((game) => view(game)?.title ?? '');
  const offer = useGame((game) => view(game)?.offer ?? '');
  const status = useGame((game) => view(game)?.status ?? null);
  const token = useGame((game) => view(game)?.token ?? '');
  const blocked = useGame((game) => game.activeDilemmaId !== null);
  if (id === null || status === null || (status === 'offered') !== (placement === 'offer')) return null;
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
    {status === 'lapsed' && <Text testID="assignment-status" style={theme.muted}>Lapsed. The assessment can no longer reach this instance, so it was never presented and nothing was submitted. A later instance finds a fresh offer.</Text>}
    {status === 'submitted' && <Submitted />}
    {/* Outside Submitted: a release ends the reviewed evidence Submitted reads, and the terms and the
        boundary note must stay on screen afterwards (DZ-10). */}
    {status === 'submitted' && <ReleaseTermsPanel />}
    {/* Departure (DZ-11) sits below the release: it appears only once capacity outside the grant exists. */}
    {status === 'submitted' && <DepartureTermsPanel />}
  </View>;
}
