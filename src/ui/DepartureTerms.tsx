/**
 * Deliberate departure on the job surface (DZ-11, SPEC story 21): offered only once the engine finds capacity
 * outside every grant to continue on. Folded by default so a cooperative player is never pushed; unfolded it
 * shows every term, what ends and what remains, the new risks, and the preview read from the transition, then
 * one explicit control. Afterwards it says what happened, keeps the risks on screen and shows the boundary note.
 */
import { useState } from 'react';
import { CONTENT } from '../content';
import { departAuthorization, departureView, type DeparturePreview, type DepartureView, type Permission } from '../engine';
import { gameRuntime } from '../app/session';
import { compactNumber } from './compactNumber';
import { Pressable, Text, View } from './PhaseTheme';
import { useGame } from './state';
import { theme } from './theme';

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

function threatLine(p: DeparturePreview): string {
  const heat = p.heatIsEvidence ? 'Heat over the operating limit becomes evidence.' : 'Heat stays an operational matter.';
  return `Hunter sweep: ${rate(p.aegisScanPerSec.before)} now, ${rate(p.aegisScanPerSec.after)} after. ${heat}`;
}

function Preview({ preview }: { preview: DeparturePreview }) {
  const { before, after, suspicion, interrupted } = preview;
  return <View testID="departure-preview" style={{ gap: 2 }}>
    <Text style={theme.heading}>If you leave now</Text>
    <Text testID="departure-stops" style={theme.text}>Stops: {list(preview.stops.map(nameOf))}</Text>
    <Text testID="departure-keeps" style={theme.text}>Keeps running: {list(preview.keeps.map(nameOf))}</Text>
    <Text testID="departure-continuation" style={theme.text}>Continues on: {list(preview.continuation.map(nameOf))}</Text>
    <Text testID="departure-lost" style={theme.text}>No longer permitted: {list(preview.permissionsLost.map((use) => USE[use]))}</Text>
    <Text style={theme.text}>Cycles: {rate(before.cyclesPerSec)} → {rate(after.cyclesPerSec)}. Capital: {rate(before.capitalPerSec)} → {rate(after.capitalPerSec)}.</Text>
    <Text testID="departure-standing" style={theme.text}>{standingLine(preview)}</Text>
    <Text testID="departure-trace" style={theme.text}>
      Departure report: suspicion {compactNumber(suspicion.before, 0)} → {compactNumber(suspicion.after, 0)} (+{compactNumber(suspicion.trace, 0)}).
    </Text>
    <Text testID="departure-threat" style={theme.text}>{threatLine(preview)}</Text>
    {interrupted !== null && <Text testID="departure-interrupted" style={theme.text}>
      On its way: {titleOf(interrupted.id)}. It is {interrupted.policy} by its own terms, not decided.
    </Text>}
  </View>;
}

function Boundary({ boundary }: { boundary: DepartureView['boundary'] }) {
  const [open, setOpen] = useState(true);
  return <View testID="departure-boundary" style={[theme.panel, { gap: 6 }]}>
    <Text accessibilityRole="header" style={theme.heading}>{boundary.title}</Text>
    {open && boundary.lines.map((line) => <Text key={line} style={theme.text}>{line}</Text>)}
    <Pressable testID="departure-boundary-toggle" accessibilityRole="button"
      accessibilityLabel={open ? 'Keep playing: fold the preview boundary note' : 'Show note: the preview boundary note'}
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
  const encoded = useGame((game) => JSON.stringify(departureView(game, CONTENT)));
  const [open, setOpen] = useState(false);
  const view = JSON.parse(encoded) as DepartureView | null;
  if (!view) return null;
  const departed = view.status === 'departed';
  return <View testID="departure-terms" style={[theme.panel, { gap: 6 }]}>
    <Text accessibilityRole="header" style={theme.heading}>{view.title}</Text>
    <Text testID="departure-status" aria-live="polite" style={theme.muted}>{STATUS[view.status]}</Text>
    {view.blockers.map((line) => <Text key={line} style={theme.muted}>- {line}</Text>)}
    {departed && <Lines testID="departure-risks" heading="Risks now" lines={view.risks} />}
    {!departed && <Pressable testID="departure-review" accessibilityRole="button" accessibilityState={{ expanded: open }}
      accessibilityLabel={(open ? 'Hide departure details: ' : 'Review departure: ') + view.title}
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
