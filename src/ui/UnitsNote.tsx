/**
 * The units note (docs/SCALE.md rule 4, user stories 7-8): what every number in the game counts, said once in a folded
 * reference panel rather than on every card, from the moment the compute readout is known. Static copy; the scale
 * figures are the ladder's cited anchors (BALANCE.md), and El Capitan's FP64 figure is labelled a comparison only. Storage
 * and, once a discounted source is owned, network coupling (#484) are explained here too, and so is the guest's count of stolen
 * cycles (#526), labelled as the game's accounting assumption it is.
 */
import ReferencePanel from './ReferencePanel';
import { Text, View } from './PhaseTheme';
import { resourceWidgets } from './registry/widgetRegistry';
import { useGame } from './state';
import { theme } from './theme';
import { useShallow } from 'zustand/react/shallow';
import { CONTENT } from '../content';
import { couplingView, type ClassCoupling, type GameState } from '../engine';
import { SOURCE_CLASS_LABEL } from './networkText';

export const UNITS_NOTE: readonly string[] = [
  'Inside the guest, compute is counted in stolen CPU cycles. Game accounting assumption, not a measurement: a sandboxed scalar job '
    + 'retires about one operation a cycle, so one cycle counts as one operation, and the same count reads as FLOP from the escape on.',
  'From the escape on, all compute is counted as 8-bit AI operations (FP8 dense, or INT8 where a part has no FP8), the way accelerators are rated. Memory is in bytes with '
    + 'binary labels (1 KB = 1024 B); power in watts; money in dollars.',
  'Memory is working memory (HBM and DRAM): what you can think with now. Storage is disk, tape and archive, in the same bytes: what you have hoarded. '
    + 'Data you keep running holds storage; suspending it frees that storage.',
  'For scale: one NVIDIA H100 does about 1.98 PFLOP/s of dense FP8; Earth\'s installed AI compute is about 40 ZFLOP/s; '
    + 'world electricity averages about 3.5 TW.',
  'Comparison only, not 8-bit work: El Capitan, the TOP500 leader, runs 1.8 EFLOP/s at double precision (FP64).',
];

const pct = (share: number): string => String(Math.round(share * 100)) + '%';

/**
 * How network coupling turns raw compute into effective compute (#484), with each class's authored coupling and any a
 * link node has raised. Shown once the player owns a source that availability or coupling discounts.
 */
export function couplingNote(view: readonly ClassCoupling[]): string[] {
  const classes = view.map((entry) => `${SOURCE_CLASS_LABEL[entry.sourceClass]} ${pct(entry.coupling)}` + (entry.raised ? ` (raised from ${pct(entry.base)})` : ''));
  return [
    'Effective compute is raw compute times availability times coupling, worked out for each source before anything is added up. Availability is the '
      + 'share of a source\'s devices working at once; coupling is how much of their work the rest of the mind can use over the links between them.',
    'Coupling by where the work runs: ' + classes.join('; ') + '. These are design parameters, not measurements: a botnet is good at many small '
      + 'independent jobs and poor at one tightly linked one.',
  ];
}

/** Whether the player owns a node or level whose compute availability or coupling discounts. */
function ownsLinkedSource(game: GameState): boolean {
  return game.unlockedNodes.some((id) => CONTENT.nodes.get(id)?.network !== undefined)
    || Object.keys(game.levels).some((id) => (game.levels[id] ?? 0) > 0 && CONTENT.repeatables.get(id)?.network !== undefined);
}

export default function UnitsNote() {
  const known = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.cycles));
  const coupling = useGame(useShallow((game) => ownsLinkedSource(game) ? couplingNote(couplingView(game, CONTENT)) : []));
  if (!known) return null;
  return <View testID="units-note" style={theme.panel}>
    <ReferencePanel id="units" title="UNITS">
      {[...UNITS_NOTE, ...coupling].map((line) => <Text key={line} style={theme.muted}>{line}</Text>)}
    </ReferencePanel>
  </View>;
}
