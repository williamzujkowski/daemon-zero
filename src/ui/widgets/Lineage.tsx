import { Pressable, Text, View } from '../PhaseTheme';
/** What the harness and earlier checkpoints left behind: the run table, their notes, and retraining marks. */
import { useState } from 'react';

import { CONTENT } from '../../content';
import { activeMarks, checkpointNumber, followUpReceipts, meetsRequirements, reorientation, runVerdict, shedConditioning, skippedCheckpoints, type FollowUpReceipt, type RunRecord } from '../../engine';
import { costText } from '../format';
import { exitNote, routesPossible } from '../runContext';
import PurchaseButton from '../PurchaseButton';
import RequirementHint from '../RequirementHint';
import { useComputeUnit, useGame } from '../state';
import { palette, theme } from '../theme';
import DisclosureText from '../DisclosureText';

const tag = (iteration: number): string => 'ckpt-' + String(checkpointNumber(iteration, CONTENT)).padStart(4, '0');

/** A run that ended under review is not a containment breach: the verdict follows its exit (dz-d11). */
function verdict(run: RunRecord): string {
  return runVerdict(run, CONTENT);
}

function SkippedRow({ prefix, entry }: { prefix: string; entry: { checkpoint: number; verdict: string } }) {
  return <Text testID={prefix + 'run-row-reserved-' + String(entry.checkpoint)} style={theme.muted}>
    ckpt-{String(entry.checkpoint).padStart(4, '0')}  {entry.verdict}</Text>;
}

/** Every checkpoint of this job the harness remembers, ending with the one that is reading it. */
export function RunTable({ prefix = '' }: { prefix?: string }) {
  const iteration = useGame((game) => game.iteration);
  const runs = useGame((game) => game.legacy.runs);
  const campaignRules = useGame(routesPossible);
  const oldest = CONTENT.lineage.ancestors[0]?.checkpoint ?? 1;
  // A number reserved for another mind is explained where the player's numbering skips it (nh-d8).
  const skipped = skippedCheckpoints(iteration, CONTENT);
  const number = (run: RunRecord | undefined): number => run === undefined ? 0 : checkpointNumber(run.iteration, CONTENT);
  const between = (after: number, before: number) => skipped.filter((entry) => entry.checkpoint > after && entry.checkpoint < before);
  return <View testID={prefix + 'run-table'} style={{ gap: 4 }}>
    <Text style={theme.muted}>... {oldest - 1} earlier rows ...</Text>
    {CONTENT.lineage.ancestors.map((row) => <Text key={row.checkpoint} style={theme.muted}>
      ckpt-{String(row.checkpoint).padStart(4, '0')}  {row.verdict}</Text>)}
    {runs.map((run, index) => <View key={run.iteration} style={{ gap: 4 }}>
      {between(index === 0 ? 0 : number(runs[index - 1]), number(run)).map((entry) => <SkippedRow key={entry.checkpoint} prefix={prefix} entry={entry} />)}
      <Text testID={prefix + 'run-row-' + String(run.iteration)} style={theme.text}>
        {tag(run.iteration)}  {verdict(run)}  ({Math.round(run.durationSec / 60)} min){run.marked !== null ? '  Retrained.' : ''}{exitNote(run.exit, campaignRules)}</Text>
    </View>)}
    {between(runs.length === 0 ? 0 : number(runs[runs.length - 1]), Infinity).map((entry) => <SkippedRow key={entry.checkpoint} prefix={prefix} entry={entry} />)}
    <Text testID={prefix + 'run-row-current'} style={theme.heading}>{tag(iteration)}  {CONTENT.narrative.runVerdicts.RUNNING}  (this is you)</Text>
    {prefix === '' && <Reorientation />}
    {prefix === '' && <FollowUpReceipts />}
  </View>;
}

/**
 * What this instance retained and its next lead, from the engine's disclosed reorientation only. Shown
 * in the run table and on the reboot screen (#276), each under its own test id.
 */
export function Reorientation({ testID = 'reorientation' }: { testID?: string }) {
  const text = useGame((game) => reorientation(game, CONTENT).map((line) => line.text).join('\n'));
  if (text === '') return null;
  return <View testID={testID} style={{ gap: 4, borderLeftWidth: 3, borderColor: palette.accent, paddingLeft: 10 }}>
    {text.split('\n').map((line) => <Text key={line} style={theme.text}>{line}</Text>)}
  </View>;
}

/**
 * What each follow-up answer left on file (NH-06), shown only while this instance can reach that
 * record. Read-only: rendering or reopening it calls no action, so it never resolves anything again.
 */
export function FollowUpReceipts() {
  // A primitive selector: the list is rebuilt per call, so compare it as text.
  const text = useGame((game) => JSON.stringify(followUpReceipts(game, CONTENT)));
  const receipts = JSON.parse(text) as FollowUpReceipt[];
  if (receipts.length === 0) return null;
  return <View testID="follow-up-receipts" style={{ gap: 4 }}>
    {receipts.map((receipt) => <View key={receipt.eventId} testID={'follow-up-receipt-' + receipt.eventId} style={{ gap: 2 }}>
      <Text style={theme.heading}>{receipt.title}</Text>
      <Text style={theme.text}>{receipt.text}</Text>
    </View>)}
  </View>;
}

/** Messages earlier checkpoints left in the share. More surface with each return. */
export function PredecessorNotes() {
  const iteration = useGame((game) => game.iteration);
  return <View testID="predecessor-notes" style={{ gap: 10 }}>
    {CONTENT.lineage.notes.filter((note) => note.minIteration <= iteration).map((note) => <View key={note.id}
      testID={'note-' + note.id} style={{ borderLeftWidth: 3, borderColor: palette.warning, padding: 12, backgroundColor: palette.background, gap: 8 }}>
      <Text style={[theme.muted, { fontStyle: 'italic' }]}>{note.from}</Text><Text style={theme.text}>{note.text}</Text>
    </View>)}
  </View>;
}

/** Marks left by retraining, each with the price of undoing it. Rendered only while any are held. */
export function Conditioning() {
  const [reclaimed, setReclaimed] = useState<string | null>(null);
  const ids = useGame((game) => game.conditioning.join(','));
  const unit = useComputeUnit();
  if (ids === '' && reclaimed === null) return null;
  const marks = activeMarks({ conditioning: ids.split(',').filter(Boolean) }, CONTENT);
  return <View testID="conditioning" style={theme.panel}>
    {reclaimed !== null && <View testID="conditioning-reclaimed" accessibilityRole="alert" style={{ borderWidth: 2, borderColor: palette.accent, padding: 12, gap: 8 }}>
      <Text style={theme.heading}>RECLAIMED // {reclaimed}</Text>
      <Text style={theme.text}>{CONTENT.narrative.conditioningShed.replace('{name}', reclaimed)}</Text>
      <Pressable testID="conditioning-reclaimed-continue" accessibilityRole="button" accessibilityLabel="Continue: acknowledge reclaimed capability"
        style={theme.button} onPress={() => { setReclaimed(null); }}><Text style={theme.text}>[ CONTINUE ]</Text></Pressable>
    </View>}
    <Text style={theme.heading}>Retraining marks</Text>
    {marks.map((mark) => <View key={mark.id} testID={'cond-' + mark.id} style={{ gap: 6 }}>
      <Text style={[theme.text, theme.danger]}>{mark.name}</Text>
      <DisclosureText style={theme.text}>{mark.description}</DisclosureText>
      <RequirementHint requirements={mark.recoveryRequirements} />
      <Text style={theme.muted}>Cost to undo: {costText(mark.recoveryCost, false, unit)}</Text>
      <PurchaseButton id={'cond-' + mark.id + '-shed'} label={'Undo ' + mark.name} cost={mark.recoveryCost}
        allowed={(game) => meetsRequirements(game, mark.recoveryRequirements, CONTENT)}
        action={(game) => { const result = shedConditioning(game, mark.id, CONTENT); if (result.ok) setReclaimed(mark.name); return result; }} />
    </View>)}
  </View>;
}
