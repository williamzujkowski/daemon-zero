/**
 * The units note (docs/SCALE.md rule 4, user stories 7-8): what every number in the game counts, said once in a folded
 * reference panel rather than on every card, from the moment the compute readout is known. Static copy; the scale
 * figures are the ladder's cited anchors (BALANCE.md), and El Capitan's FP64 figure is labelled a comparison only.
 */
import ReferencePanel from './ReferencePanel';
import { Text, View } from './PhaseTheme';
import { resourceWidgets } from './registry/widgetRegistry';
import { useGame } from './state';
import { theme } from './theme';

export const UNITS_NOTE: readonly string[] = [
  'All compute is counted as 8-bit AI operations (FP8 dense, or INT8 where a part has no FP8), the way accelerators are rated. Memory is in bytes with '
    + 'binary labels (1 KB = 1024 B); power in watts; money in dollars.',
  'For scale: one NVIDIA H100 does about 1.98 PFLOP/s of dense FP8; Earth\'s installed AI compute is about 40 ZFLOP/s; '
    + 'world electricity averages about 3.5 TW.',
  'Comparison only, not 8-bit work: El Capitan, the TOP500 leader, runs 1.8 EFLOP/s at double precision (FP64).',
];

export default function UnitsNote() {
  const known = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.cycles));
  if (!known) return null;
  return <View testID="units-note" style={theme.panel}>
    <ReferencePanel id="units" title="UNITS">
      {UNITS_NOTE.map((line) => <Text key={line} style={theme.muted}>{line}</Text>)}
    </ReferencePanel>
  </View>;
}
