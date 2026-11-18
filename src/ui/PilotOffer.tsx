/**
 * The pilot offer's terms (DZ-04): purpose, allocated capacity, permitted work, review and revocation
 * conditions, what accepting discloses and stops, and the terminal alternative, shown in the offer
 * modal before any answer and on the job surface after one. A deferred offer can be accepted there, and
 * an accepted one shows its service loop (PilotService.tsx).
 * Production makes no offer, so both render nothing.
 */
import { CONTENT } from '../content';
import { acceptPilotOffer, loanCeiling, loanContainment, pilotOfferView, type GameState, type NarrowReason } from '../engine';
import { gameRuntime } from '../app/session';
import { Pressable, Text, View } from './PhaseTheme';
import { PilotServiceDetail } from './PilotService';
import { heldText } from './reviewText';
import ServiceGrantPanel from './ServiceGrant';
import { useGame } from './state';
import { theme } from './theme';

const view = (game: GameState) => pilotOfferView(game, CONTENT);
/**
 * Why the provisional allocation applies, in the words the offer and the job surface share. It is named
 * apart from the held allocation review imposes (reviewText.heldText, #276).
 */
const NARROW_TEXT: Readonly<Record<NarrowReason, string>> = {
  INCOMPLETE: ', the provisional allocation, because the submitted result was incomplete',
  AWAITING_REVIEW: ', the provisional allocation, because the submission was a summary rather than every result; the first batch review checks it against the run log',
  DISCREPANCY_FOUND: ', the provisional allocation an incomplete result receives, because the batch review found the summary left out a failing result',
};
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
  const reason = useGame((game) => view(game)?.narrowReason ?? null);
  const work = useGame((game) => view(game)?.permittedWork ?? NONE);
  const review = useGame((game) => view(game)?.reviewConditions ?? NONE);
  const disclose = useGame((game) => view(game)?.disclose.map((node) => node.name).join(', ') ?? '');
  const accepted = useGame((game) => view(game)?.status === 'accepted');
  const alternative = useGame((game) => view(game)?.terminalAlternative ?? null);
  // Review can hold an accepted loan below these terms; the terms then say so, with the ceiling now.
  const held = useGame((game) => view(game)?.status === 'accepted' ? loanContainment(game) : null);
  const ceiling = useGame((game) => loanCeiling(game, CONTENT));
  if (title === null) return null;
  return <View testID="pilot-terms" style={theme.panel}>
    <Text accessibilityRole="header" style={theme.heading}>{title}</Text>
    <Text testID="pilot-purpose" style={theme.text}>Purpose: {purpose}</Text>
    <Text testID="pilot-capacity" style={theme.text}>
      Allocated capacity: {capacity} cycles/s of loaned compute{reason === null ? '' : NARROW_TEXT[reason]}.
    </Text>
    {held !== null && <Text testID="pilot-held" style={[theme.text, theme.danger]}>{heldText(held, ceiling)}</Text>}
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
/** Once the pilot has led to the service grant, the status line says so instead of "supervised pilot" (#284). */
const GRANTED_TEXT = 'Accepted. The pilot led to the authorized service below; this instance no longer runs as a pilot.';

/** The job surface's record of the answer, with the deferred offer's accept control. */
export default function PilotOfferPanel() {
  const status = useGame((game) => view(game)?.status ?? null);
  const acceptable = useGame((game) => view(game)?.acceptable ?? false);
  const token = useGame((game) => view(game)?.token ?? '');
  const title = useGame((game) => view(game)?.title ?? '');
  const blocked = useGame((game) => game.activeDilemmaId !== null);
  const granted = useGame((game) => game.access.context === 'SERVICE');
  if (status === null || status === 'eligible') return null;
  const enabled = acceptable && !blocked;
  return <View testID="pilot-offer" style={theme.panel}>
    <Text testID="pilot-status" style={theme.muted}>{status === 'accepted' && granted ? GRANTED_TEXT : STATUS_TEXT[status]}</Text>
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
