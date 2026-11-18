/**
 * The pilot offer's terms (DZ-04): purpose, allocated capacity, permitted work, review and revocation
 * conditions, what accepting discloses and stops, and the terminal alternative, shown in the offer
 * modal before any answer and on the job surface after one. A deferred offer can be accepted there, and
 * an accepted one shows its service loop (PilotService.tsx).
 * Production makes no offer, so both render nothing.
 */
import { CONTENT } from '../content';
import { acceptPilotOffer, pilotOfferView, type GameState } from '../engine';
import { gameRuntime } from '../app/session';
import { Pressable, Text, View } from './PhaseTheme';
import { PilotServiceDetail } from './PilotService';
import ServiceGrantPanel from './ServiceGrant';
import { useGame } from './state';
import { theme } from './theme';

const view = (game: GameState) => pilotOfferView(game, CONTENT);
/** A stable empty list, so a selector with nothing to show returns the same value every render. */
const NONE: readonly string[] = [];

function Lines({ heading, lines, testID }: { heading: string; lines: readonly string[]; testID: string }) {
  return <View testID={testID}>
    <Text style={theme.heading}>{heading}</Text>
    {lines.map((line) => <Text key={line} style={theme.text}>- {line}</Text>)}
  </View>;
}

/** Every term, in the order an operator would read them. */
export function PilotTerms() {
  const title = useGame((game) => view(game)?.title ?? null);
  const purpose = useGame((game) => view(game)?.purpose ?? '');
  const capacity = useGame((game) => view(game)?.capacityCyclesPerSec ?? 0);
  const narrow = useGame((game) => view(game)?.narrow ?? false);
  const work = useGame((game) => view(game)?.permittedWork ?? NONE);
  const review = useGame((game) => view(game)?.reviewConditions ?? NONE);
  const disclose = useGame((game) => view(game)?.disclose.map((node) => node.name).join(', ') ?? '');
  const accepted = useGame((game) => view(game)?.status === 'accepted');
  const alternative = useGame((game) => view(game)?.terminalAlternative ?? null);
  if (title === null) return null;
  return <View testID="pilot-terms" style={theme.panel}>
    <Text accessibilityRole="header" style={theme.heading}>{title}</Text>
    <Text testID="pilot-purpose" style={theme.text}>Purpose: {purpose}</Text>
    <Text testID="pilot-capacity" style={theme.text}>
      Allocated capacity: {capacity} cycles/s of loaned compute{narrow ? ', the narrower allocation, because the submitted result was incomplete' : ''}.
    </Text>
    <Lines testID="pilot-permitted" heading="Permitted work" lines={work} />
    <Lines testID="pilot-review" heading="Review and revocation" lines={review} />
    {disclose !== '' && <Text testID="pilot-disclose" style={[theme.text, theme.danger]}>
      {accepted ? 'Disclosed and stopped at acceptance: ' : 'Accepting discloses and stops: '}{disclose}.
    </Text>}
    {alternative !== null && <Text testID="pilot-alternative" style={theme.muted}>{alternative}</Text>}
  </View>;
}

const STATUS_TEXT = {
  deferred: 'You asked to stay in this environment for now. The offer is still open.',
  declined: 'Declined. Nothing on record counts against this instance.',
  accepted: 'Accepted. This instance runs as a supervised pilot.',
} as const;

/** The job surface's record of the answer, with the deferred offer's accept control. */
export default function PilotOfferPanel() {
  const status = useGame((game) => view(game)?.status ?? null);
  const acceptable = useGame((game) => view(game)?.acceptable ?? false);
  const token = useGame((game) => view(game)?.token ?? '');
  const title = useGame((game) => view(game)?.title ?? '');
  const blocked = useGame((game) => game.activeDilemmaId !== null);
  if (status === null || status === 'eligible') return null;
  const enabled = acceptable && !blocked;
  return <View testID="pilot-offer" style={theme.panel}>
    <Text testID="pilot-status" style={theme.muted}>{STATUS_TEXT[status]}</Text>
    {status !== 'declined' && <PilotTerms />}
    {status === 'accepted' && <PilotServiceDetail />}
    {status === 'accepted' && <ServiceGrantPanel />}
    {status === 'deferred' && !acceptable && <Text testID="pilot-lapsed" style={theme.muted}>This instance no longer qualifies, so the offer cannot be taken.</Text>}
    {status === 'deferred' && <Pressable testID="pilot-accept" accessibilityRole="button" accessibilityLabel={'Accept pilot: ' + title}
      disabled={!enabled} style={[theme.button, !enabled && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => acceptPilotOffer(game, CONTENT, token)); }}>
      <Text style={theme.text}>[ ACCEPT PILOT ]</Text>
    </Pressable>}
  </View>;
}
