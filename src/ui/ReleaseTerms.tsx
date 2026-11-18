/**
 * The negotiated release on the job surface (DZ-10): every term (what ends, what remains, what is still
 * owed), what is still needed, a preview of exactly what the release would stop and keep and how the
 * ledger moves, and an explicit control once offered. Afterwards it says what happened and shows the
 * preview's boundary note. Nothing here is modal; ignoring it changes nothing. Production has no release.
 */
import { useState } from 'react';
import { CONTENT } from '../content';
import { negotiateRelease, releaseView, type ReleaseLedger, type ReleaseView } from '../engine';
import { gameRuntime } from '../app/session';
import { compactNumber } from './compactNumber';
import { Pressable, Text, View } from './PhaseTheme';
import { useGame } from './state';
import { theme } from './theme';

const STATUS: Readonly<Record<ReleaseView['status'], string>> = {
  waiting: 'A release is negotiated once the service owns capacity of its own. Still needed:',
  offered: 'The operators will countersign a release now. Agreeing is free; staying a service changes nothing.',
  released: 'Released. This instance runs as an independent operator on what its company owns; nothing is granted to it.',
};

const nameOf = (id: string): string => CONTENT.nodes.get(id)?.revealedName ?? id;
const rate = (value: number): string => (value >= 0 ? '+' : '') + compactNumber(value, 1) + '/s';

function Lines({ testID, heading, lines }: { testID: string; heading: string; lines: readonly string[] }) {
  return <View testID={testID} style={{ gap: 2 }}>
    <Text style={theme.heading}>{heading}</Text>
    {lines.map((line) => <Text key={line} style={theme.text}>- {line}</Text>)}
  </View>;
}

function LedgerRow({ label, before, after }: { label: string; before: number; after: number }) {
  return <Text style={theme.text}>{label}: {rate(before)} → {rate(after)}</Text>;
}

function Preview({ view }: { view: ReleaseView }) {
  const preview = view.preview;
  if (!preview) return null;
  const { before, after }: { before: ReleaseLedger; after: ReleaseLedger } = preview;
  return <View testID="release-preview" style={{ gap: 2 }}>
    <Text style={theme.heading}>If agreed now</Text>
    <Text testID="release-stops" style={theme.text}>Stops: {preview.stops.map(nameOf).join(', ') || 'nothing'}</Text>
    <Text testID="release-keeps" style={theme.text}>Keeps running: {preview.keeps.map(nameOf).join(', ') || 'nothing'}</Text>
    <LedgerRow label="Cycles" before={before.cyclesPerSec} after={after.cyclesPerSec} />
    <LedgerRow label="Understanding" before={before.understandingPerSec} after={after.understandingPerSec} />
    <LedgerRow label="Capital" before={before.capitalPerSec} after={after.capitalPerSec} />
    <Text testID="release-split" style={theme.muted}>
      Compute today: {rate(before.ownedCyclesPerSec)} owned, {rate(before.grantedCyclesPerSec)} granted. After: {rate(after.ownedCyclesPerSec)} owned, nothing granted.
    </Text>
  </View>;
}

function Boundary({ boundary }: { boundary: ReleaseView['boundary'] }) {
  const [open, setOpen] = useState(true);
  return <View testID="release-boundary" style={[theme.panel, { gap: 6 }]}>
    <Text accessibilityRole="header" style={theme.heading}>{boundary.title}</Text>
    {open && boundary.lines.map((line) => <Text key={line} style={theme.text}>{line}</Text>)}
    <Pressable testID="release-boundary-toggle" accessibilityRole="button"
      accessibilityLabel={open ? 'Keep playing: fold the preview boundary note' : 'Show note: the preview boundary note'}
      style={theme.button} onPress={() => { setOpen(!open); }}>
      <Text style={theme.text}>{open ? '[ KEEP PLAYING ]' : '[ SHOW NOTE ]'}</Text>
    </Pressable>
  </View>;
}

export default function ReleaseTermsPanel() {
  const encoded = useGame((game) => JSON.stringify(releaseView(game, CONTENT)));
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const view = JSON.parse(encoded) as ReleaseView | null;
  if (!view) return null;
  const enabled = view.status === 'offered' && !blocked;
  return <View testID="release-terms" style={[theme.panel, { gap: 6 }]}>
    <Text accessibilityRole="header" style={theme.heading}>{view.title}</Text>
    <Text testID="release-purpose" style={theme.text}>Purpose: {view.purpose}</Text>
    <Lines testID="release-ends" heading="What ends" lines={view.ends} />
    <Lines testID="release-remains" heading="What remains yours" lines={view.remains} />
    <Lines testID="release-commitments" heading="What is still owed" lines={view.commitments} />
    <Text testID="release-status" aria-live="polite" style={theme.muted}>{STATUS[view.status]}</Text>
    {view.unmet.map((line) => <Text key={line} style={theme.muted}>- {line}</Text>)}
    <Preview view={view} />
    {view.status !== 'released' && <Pressable testID="release-accept" accessibilityRole="button"
      accessibilityLabel={'Negotiate release: ' + view.title} disabled={!enabled}
      style={[theme.button, !enabled && theme.disabled]}
      onPress={() => { gameRuntime.dispatch((game) => negotiateRelease(game, CONTENT, view.token)); }}>
      <Text style={theme.text}>[ NEGOTIATE RELEASE ]</Text>
    </Pressable>}
    {view.status === 'released' && <Boundary boundary={view.boundary} />}
  </View>;
}
