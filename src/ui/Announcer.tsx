import { Text, View } from './PhaseTheme';
/**
 * The one announcement path for events that change what the player can do (vote-1795210455666-e01ydjc, F1b): a
 * visually hidden polite live region in the chrome. It speaks a phase change the boundary dialog does not already
 * open for (#356), each newly unlocked widget by its content title and slot (#357), and the AEGIS lock crossing its
 * critical mark (#360). A restore, a wipe or the first frame sets the baseline and says nothing, so nothing replays.
 */
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { CONTENT } from '../content';
import { thresholdCopy } from '../engine';
import { selectReady, useGameValue } from '../app/selectors';
import { AEGIS_CRITICAL, aegisCritical, threatWidget } from './registry/widgetRegistry';
import { useGame } from './state';
import { theme } from './theme';

interface Seen { ready: boolean; revision: number; iteration: number; phase: number; widgets: string; aegis: boolean; message: string; seq: number }

/** The escape and an arrangement's declared boundary open their own dialog (PhaseThreshold), which already speaks. */
function opensDialog(access: Parameters<typeof thresholdCopy>[0]['access'], from: number, to: number): boolean {
  const escape = from === CONTENT.phases[0]?.phaseId && to === CONTENT.phases[1]?.phaseId;
  return escape || thresholdCopy({ access }, from, to, CONTENT) !== null;
}

function eventLines(seen: Seen, now: Omit<Seen, 'message' | 'seq'>, access: Parameters<typeof opensDialog>[0]): string[] {
  const lines: string[] = [];
  if (now.phase > seen.phase && !opensDialog(access, seen.phase, now.phase)) {
    const phase = CONTENT.phases.find((entry) => entry.phaseId === now.phase);
    lines.push(`Phase ${String(now.phase)}${phase ? ': ' + phase.title : ''}.`);
  }
  const before = new Set(seen.widgets.split(' '));
  for (const id of now.widgets.split(' ')) {
    const widget = id !== '' && !before.has(id) ? CONTENT.widgets.get(id) : undefined;
    if (widget) lines.push(`New on ${widget.slot}: ${widget.title}.`);
  }
  if (now.aegis && !seen.aegis) lines.push(`AEGIS hunter lock past ${String(AEGIS_CRITICAL)}%: the hunters are close to locking on.`);
  return lines;
}

export default function Announcer() {
  const ready = useGameValue(selectReady);
  const revision = useGameValue((state) => state.restoreRevision);
  const iteration = useGame((game) => game.iteration);
  const phase = useGame((game) => game.currentPhase);
  const access = useGame((game) => game.access);
  const widgets = useGame((game) => game.unlockedWidgets.join(' '));
  const aegis = useGame((game) => game.unlockedWidgets.includes(threatWidget) && aegisCritical(game.aegisLock));
  const now = { ready, revision, iteration, phase, widgets, aegis };
  const [seen, setSeen] = useState<Seen>({ ...now, message: '', seq: 0 });
  if (!ready || seen.ready !== ready || seen.revision !== revision || seen.iteration !== iteration) {
    // A baseline, never an event: loading, restoring or rebooting must not replay what the save already holds.
    if (seen.ready !== ready || seen.revision !== revision || seen.iteration !== iteration) setSeen({ ...now, message: '', seq: seen.seq });
  } else if (seen.phase !== phase || seen.widgets !== widgets || seen.aegis !== aegis) {
    const lines = eventLines(seen, now, access);
    setSeen({ ...now, message: lines.length > 0 ? lines.join(' ') : seen.message, seq: seen.seq + (lines.length > 0 ? 1 : 0) });
  }
  return <View testID="announcer" role="status" accessibilityLiveRegion="polite" style={styles.hidden}>
    {seen.message !== '' && <Text key={seen.seq} style={theme.text}>{seen.message}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  // Read by assistive technology, not drawn: the sighted cues stay where they are (and the tab badges, F1c).
  hidden: { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', borderWidth: 0 },
});
