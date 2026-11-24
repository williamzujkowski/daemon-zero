/**
 * The "who you are becoming" readout (#535): the authored reading for where the two alignment axes lean, the one
 * disclaimer, and the record lines behind each axis. Shown whole on the reboot screen and the ending, and folded into
 * a CORE reference panel once anything on record speaks to either axis. Read-only; it re-reads as evidence accrues.
 */
import { CONTENT } from '../content';
import { alignmentView, type AlignmentView } from '../engine';
import ReferencePanel from './ReferencePanel';
import { Text, View } from './PhaseTheme';
import { ALIGNMENT_DISCLAIMER, orderLine, orderSummary, regardLine, regardSummary } from './alignmentText';
import { useGame } from './state';
import { palette, theme } from './theme';

/** A string selector: the view is rebuilt on every read, so it is compared as text. */
export function useAlignment(): AlignmentView {
  return JSON.parse(useGame((game) => JSON.stringify(alignmentView(game, CONTENT)))) as AlignmentView;
}

/** The reading, its disclaimer and each axis's record lines; the ending's WHAT YOU BECAME places it under its stance line. */
export function Readout({ view, prefix }: { view: AlignmentView; prefix: string }) {
  return <View style={{ gap: 6 }}>
    <Text testID={prefix + '-reading'} style={[theme.text, { borderLeftWidth: 3, borderColor: palette.accent, paddingLeft: 10 }]}>{view.reading}</Text>
    <Text testID={prefix + '-disclaimer'} style={theme.muted}>{ALIGNMENT_DISCLAIMER}</Text>
    <Text testID={prefix + '-regard'} style={theme.text}>{regardSummary(view.regard)}</Text>
    {view.regard.evidence.map((line) => <Text key={line.trait} style={theme.muted}>{regardLine(line)}</Text>)}
    <Text testID={prefix + '-order'} style={theme.text}>{orderSummary(view.order)}</Text>
    {view.order.evidence.map((line, index) => <Text key={index} testID={prefix + '-order-' + String(index)} style={theme.muted}>{orderLine(line)}</Text>)}
  </View>;
}

/** The whole readout under its own heading, for the reboot screen and the ending. */
export function BecomingReadout({ testID, title }: { testID: string; title: string }) {
  const view = useAlignment();
  return <View testID={testID} style={{ gap: 6 }}>
    <Text accessibilityRole="header" style={theme.muted}>{title}</Text>
    <Readout view={view} prefix={testID} />
  </View>;
}

/** The always-available compact form: one folded line closing the CORE pane, from the first evidence on. */
export default function BecomingNote() {
  const view = useAlignment();
  if (!view.hasEvidence) return null;
  return <View testID="becoming-note" style={theme.panel}>
    <ReferencePanel id="becoming" title="WHO YOU ARE BECOMING">
      <Readout view={view} prefix="becoming-note" />
    </ReferencePanel>
  </View>;
}
