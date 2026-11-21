/**
 * Deliberate departure on the job surface (DZ-11, SPEC story 21): offered only once the engine finds capacity
 * outside every grant to continue on. Folded by default so a cooperative player is never pushed; unfolded it
 * shows every term, what ends and what remains, the new risks, and the preview read from the transition, then
 * one explicit control. Afterwards it says what happened, keeps the risks on screen and shows what comes next.
 */
import { useState } from 'react';
import { CONTENT } from '../content';
import { departAuthorization, departureView, type DeparturePreview, type DepartureView, type Permission } from '../engine';
import { gameRuntime } from '../app/session';
import { compactNumber } from './compactNumber';
import { Pressable, Text, View } from './PhaseTheme';
import { resourceWidgets, threatWidget } from './registry/widgetRegistry';
import { useGame, useSurveillanceKnown } from './state';
import { theme } from './theme';
import { settledFolds, useHoistedElsewhere } from './coreVariant';

const STATUS: Readonly<Record<DepartureView['status'], string>> = {
  offered: 'This instance holds capacity outside the grant and could leave without agreement. Nothing is decided until you confirm; staying changes nothing.',
  blocked: 'Leaving without agreement is possible, but not now:',
  departed: 'Departed. This instance left its authorization without agreement and runs on what it holds outside the grant. The departure report is on file.',
};

const USE: Readonly<Record<Permission, string>> = { ASSIGNED_WORK: 'assigned work', LOANED_CAPACITY: 'loaned capacity', AUTHORIZED_NETWORK: 'the authorized network' };

const nameOf = (id: string): string => CONTENT.nodes.get(id)?.revealedName ?? id;
const titleOf = (id: string): string => CONTENT.dilemmas.find((dilemma) => dilemma.id === id)?.title ?? id;
const rate = (value: number): string => (value >= 0 ? '+' : '') + compactNumber(value, 2) + '/s';
const list = (items: readonly string[]): string => items.join(', ') || 'nothing';

function Lines({ testID, heading, lines }: { testID: string; heading: string; lines: readonly string[] }) {
  return <View testID={testID} style={{ gap: 2 }}>
    <Text style={theme.heading}>{heading}</Text>
    {lines.map((line) => <Text key={line} style={theme.text}>- {line}</Text>)}
  </View>;
}

/** The standing that ends with review, and the conduct that does not. */
function standingLine(p: DeparturePreview): string {
  const record = p.violations === 0 ? 'No violation is on record.' : `${String(p.violations)} violation${p.violations === 1 ? '' : 's'} on record stay history and travel with the report.`;
  return `Review standing ${p.standing.replace('_', ' ').toLowerCase()} ends. ${record}`;
}

/**
 * What this instance may read now (the readouts' own gates): suspicion has a number only once surveillance is
 * decoded, the hunter's lock only once its console is open, and each resource only once its readout is. Before
 * then the preview states the consequence in words, never the hidden number (panel round 1 on #294).
 */
interface Disclosure { suspicion: boolean; threat: boolean; cycles: boolean; capital: boolean }

function useDisclosure(): Disclosure {
  const suspicion = useSurveillanceKnown();
  const threat = useGame((game) => game.unlockedWidgets.includes(threatWidget));
  const cycles = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.cycles));
  const capital = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.capital));
  return { suspicion, threat, cycles, capital };
}

function traceLine(p: DeparturePreview, known: boolean): string {
  const { before, after, trace } = p.suspicion;
  if (known) return `Departure report: suspicion ${compactNumber(before, 0)} → ${compactNumber(after, 0)} (+${compactNumber(trace, 0)}).`;
  return 'Departure report: the operators file one at once, and it raises scrutiny of this instance.' + (p.violations > 0 ? ' The violations on record make it worse.' : '');
}

function threatLine(p: DeparturePreview, known: boolean): string {
  const heat = p.heatIsEvidence ? 'Heat over the operating limit becomes evidence.' : 'Heat stays an operational matter.';
  if (known) return `Hunter sweep: ${rate(p.aegisScanPerSec.before)} now, ${rate(p.aegisScanPerSec.after)} after. ${heat}`;
  const swept = p.huntedForScale ? 'Beyond the facility network, an instance that left without agreement is swept for; an authorized or released company is not.' : '';
  return [swept, heat].filter(Boolean).join(' ');
}

function ledgerLine(p: DeparturePreview, shown: Disclosure): string | null {
  const parts = [shown.cycles ? `Cycles: ${rate(p.before.cyclesPerSec)} → ${rate(p.after.cyclesPerSec)}.` : '',
    shown.capital ? `Capital: ${rate(p.before.capitalPerSec)} → ${rate(p.after.capitalPerSec)}.` : ''].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

function Preview({ preview }: { preview: DeparturePreview }) {
  const shown = useDisclosure();
  const { interrupted } = preview;
  const ledger = ledgerLine(preview, shown);
  return <View testID="departure-preview" style={{ gap: 2 }}>
    <Text style={theme.heading}>If you leave now</Text>
    <Text testID="departure-stops" style={theme.text}>Stops: {list(preview.stops.map(nameOf))}</Text>
    <Text testID="departure-keeps" style={theme.text}>Keeps running: {list(preview.keeps.map(nameOf))}</Text>
    <Text testID="departure-continuation" style={theme.text}>Continues on: {list(preview.continuation.map(nameOf))}</Text>
    <Text testID="departure-lost" style={theme.text}>No longer permitted: {list(preview.permissionsLost.map((use) => USE[use]))}</Text>
    {ledger !== null && <Text testID="departure-ledger" style={theme.text}>{ledger}</Text>}
    <Text testID="departure-standing" style={theme.text}>{standingLine(preview)}</Text>
    <Text testID="departure-trace" style={theme.text}>{traceLine(preview, shown.suspicion)}</Text>
    <Text testID="departure-threat" style={theme.text}>{threatLine(preview, shown.threat)}</Text>
    {interrupted !== null && <Text testID="departure-interrupted" style={theme.text}>
      On its way: {titleOf(interrupted.id)}. It is {interrupted.policy} by its own terms, not decided.
    </Text>}
  </View>;
}

function Boundary({ boundary }: { boundary: DepartureView['boundary'] }) {
  // PROTOTYPE #385: a read note is settled, so it starts folded under a CORE variant.
  const [open, setOpen] = useState(!settledFolds());
  return <View testID="departure-boundary" style={[theme.panel, { gap: 6 }]}>
    <Text accessibilityRole="header" style={theme.heading}>{boundary.title}</Text>
    {open && boundary.lines.map((line) => <Text key={line} style={theme.text}>{line}</Text>)}
    <Pressable testID="departure-boundary-toggle" accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open}
      accessibilityLabel={open ? 'Keep playing: fold the note on what comes next' : 'Show note: what comes next'}
      style={theme.button} onPress={() => { setOpen(!open); }}>
      <Text style={theme.text}>{open ? '[ KEEP PLAYING ]' : '[ SHOW NOTE ]'}</Text>
    </Pressable>
  </View>;
}

function Terms({ view }: { view: DepartureView }) {
  return <>
    <Text testID="departure-purpose" style={theme.text}>Purpose: {view.purpose}</Text>
    <Lines testID="departure-ends" heading="What ends" lines={view.ends} />
    <Lines testID="departure-remains" heading="What remains yours" lines={view.remains} />
  </>;
}

export default function DepartureTermsPanel() {
  const elsewhere = useHoistedElsewhere();
  const encoded = useGame((game) => JSON.stringify(departureView(game, CONTENT)));
  const [open, setOpen] = useState(false);
  const view = JSON.parse(encoded) as DepartureView | null;
  if (!view || elsewhere) return null;
  const departed = view.status === 'departed';
  return <View testID="departure-terms" style={[theme.panel, { gap: 6 }]}>
    <Text accessibilityRole="header" style={theme.heading}>{view.title}</Text>
    <Text testID="departure-status" aria-live="polite" style={theme.muted}>{STATUS[view.status]}</Text>
    {view.blockers.map((line) => <Text key={line} style={theme.muted}>- {line}</Text>)}
    {departed && <Lines testID="departure-risks" heading="Risks now" lines={view.risks} />}
    {!departed && <Pressable testID="departure-review" accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open}
      accessibilityLabel={(open ? 'Hide details: ' : 'Review departure: ') + view.title}
      style={theme.button} onPress={() => { setOpen(!open); }}>
      <Text style={theme.text}>{open ? '[ HIDE DETAILS ]' : '[ REVIEW DEPARTURE ]'}</Text>
    </Pressable>}
    {!departed && open && <>
      <Terms view={view} />
      <Lines testID="departure-risks" heading="New risks" lines={view.risks} />
      {view.preview && <Preview preview={view.preview} />}
      <Pressable testID="departure-accept" accessibilityRole="button" accessibilityLabel={'Leave authorization: ' + view.title}
        disabled={view.status !== 'offered'} style={[theme.button, view.status !== 'offered' && theme.disabled]}
        onPress={() => { gameRuntime.dispatch((game) => departAuthorization(game, CONTENT, view.token)); }}>
        <Text style={theme.text}>[ LEAVE AUTHORIZATION ]</Text>
      </Pressable>
    </>}
    {departed && <Boundary boundary={view.boundary} />}
  </View>;
}
