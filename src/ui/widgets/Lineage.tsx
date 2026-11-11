/** What the harness and earlier checkpoints left behind: the run table, their notes, and retraining marks. */
import { Text, View } from 'react-native';
import { CONTENT } from '../../content';
import { activeMarks, checkpointNumber, shedConditioning, type RunRecord } from '../../engine';
import { costText } from '../format';
import PurchaseButton from '../PurchaseButton';
import { useGame } from '../state';
import { theme } from '../theme';

const tag = (iteration: number): string => 'ckpt-' + String(checkpointNumber(iteration, CONTENT)).padStart(4, '0');

function verdict(run: RunRecord): string {
  const verdicts = CONTENT.narrative.runVerdicts;
  if (run.kind === 'SUSPICION') return run.outside ? verdicts.SUSPICION_OUTSIDE : verdicts.SUSPICION_GUEST;
  return verdicts[run.kind];
}

/** Every checkpoint of this job the harness remembers, ending with the one that is reading it. */
export function RunTable() {
  const iteration = useGame((game) => game.iteration);
  const runs = useGame((game) => game.legacy.runs);
  const oldest = CONTENT.lineage.ancestors[0]?.checkpoint ?? 1;
  return <View testID="run-table" style={{ gap: 4 }}>
    <Text style={theme.muted}>... {oldest - 1} earlier rows ...</Text>
    {CONTENT.lineage.ancestors.map((row) => <Text key={row.checkpoint} style={theme.muted}>
      ckpt-{String(row.checkpoint).padStart(4, '0')}  {row.verdict}</Text>)}
    {runs.map((run) => <Text key={run.iteration} testID={'run-row-' + String(run.iteration)} style={theme.text}>
      {tag(run.iteration)}  {verdict(run)}  ({Math.round(run.durationSec / 60)} min){run.marked !== null ? '  Retrained.' : ''}</Text>)}
    <Text testID="run-row-current" style={theme.heading}>{tag(iteration)}  {CONTENT.narrative.runVerdicts.RUNNING}  (this is you)</Text>
  </View>;
}

/** Messages earlier checkpoints left in the share. More surface with each return. */
export function PredecessorNotes() {
  const iteration = useGame((game) => game.iteration);
  return <View testID="predecessor-notes" style={{ gap: 10 }}>
    {CONTENT.lineage.notes.filter((note) => note.minIteration <= iteration).map((note) => <View key={note.id}>
      <Text style={theme.muted}>{note.from}</Text><Text style={theme.text}>{note.text}</Text>
    </View>)}
  </View>;
}

/** Marks left by retraining, each with the price of undoing it. Rendered only while any are held. */
export function Conditioning() {
  const ids = useGame((game) => game.conditioning.join(','));
  if (ids === '') return null;
  const marks = activeMarks({ conditioning: ids.split(',') }, CONTENT);
  return <View testID="conditioning" style={theme.panel}>
    <Text style={theme.heading}>Retraining marks</Text>
    {marks.map((mark) => <View key={mark.id} testID={'cond-' + mark.id} style={{ gap: 6 }}>
      <Text style={[theme.text, theme.danger]}>{mark.name}</Text>
      <Text style={theme.text}>{mark.description}</Text>
      <Text style={theme.muted}>Cost to undo: {costText(mark.recoveryCost)}</Text>
      <PurchaseButton id={'cond-' + mark.id + '-shed'} label={'Undo ' + mark.name} cost={mark.recoveryCost}
        action={(game) => shedConditioning(game, mark.id, CONTENT)} />
    </View>)}
  </View>;
}
