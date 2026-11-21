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
import { dilemmaOmen, phaseTitle, thresholdCopy, wildEncounterView } from '../engine';
import { gameStore } from '../app/session';
import { disclosed } from './DisclosureText';
import { selectReady, useGameValue } from '../app/selectors';
import { AEGIS_CRITICAL, aegisCritical, threatWidget } from './registry/widgetRegistry';
import { useGame, useSurveillanceKnown } from './state';
import { theme } from './theme';

interface Line { seq: number; text: string; at: number }
interface Seen { ready: boolean; revision: number; iteration: number; phase: number; widgets: string; aegis: boolean; signal: string; omen: string; lines: Line[]; seq: number }
/** A burst (a phase change that also reveals a signal) keeps its sentences as separate lines, so a later one does
 *  not replace an earlier one before it is read; lines older than the burst window are dropped, so nothing from
 *  minutes ago is re-presented with a new event. */
const KEPT_LINES = 3;
const BURST_SEC = 2;

/** The escape and an arrangement's declared boundary open their own dialog (PhaseThreshold), which already speaks. */
function opensDialog(access: Parameters<typeof thresholdCopy>[0]['access'], from: number, to: number): boolean {
  const escape = from === CONTENT.phases[0]?.phaseId && to === CONTENT.phases[1]?.phaseId;
  return escape || thresholdCopy({ access }, from, to, CONTENT) !== null;
}

function eventLines(seen: Seen, now: Omit<Seen, 'lines' | 'seq'>, access: Parameters<typeof opensDialog>[0]): string[] {
  const lines: string[] = [];
  if (now.phase > seen.phase && !opensDialog(access, seen.phase, now.phase)) {
    // The arrangement's own title (a pilot or service instance has its own phases, #394), which already leads with
    // its number ("Phase 2: Authorized Network Service"); spoken as written.
    const title = phaseTitle({ access }, now.phase, CONTENT);
    lines.push(/^phase\b/i.test(title) ? `${title}.` : `Phase ${String(now.phase)}: ${title}.`);
  }
  const before = new Set(seen.widgets.split(' '));
  for (const id of now.widgets.split(' ')) {
    const widget = id !== '' && !before.has(id) ? CONTENT.widgets.get(id) : undefined;
    if (widget) lines.push(`New on ${widget.slot}: ${widget.title}.`);
  }
  if (now.aegis && !seen.aegis) lines.push(`AEGIS hunter lock past ${String(AEGIS_CRITICAL)}%: the hunters are close to locking on.`);
  // The omen: on the phone its notice lives in CORE and is absent off CORE, so its arrival is spoken here (#399, #393).
  if (now.omen !== '' && now.omen !== seen.omen) lines.push(`Omen: ${now.omen}`);
  // A wild signal waits in SWARM, a sub-area the player may not have open (#358).
  if (now.signal !== '' && now.signal !== seen.signal) lines.push(`Wild signal pending: ${now.signal}. Review it in SWARM.`);
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
  const signal = useGame((game) => wildEncounterView(game, CONTENT)?.title ?? '');
  const known = useSurveillanceKnown();
  const omen = useGame((game) => {
    const pending = game.ending === null ? CONTENT.dilemmas.find((entry) => entry.id === game.pendingDilemma?.id) : undefined;
    return pending ? dilemmaOmen(game, pending, CONTENT) : '';
  });
  const now = { ready, revision, iteration, phase, widgets, aegis, signal, omen: omen === '' ? '' : disclosed(omen, known) };
  const [seen, setSeen] = useState<Seen>({ ...now, lines: [], seq: 0 });
  if (!ready || seen.ready !== ready || seen.revision !== revision || seen.iteration !== iteration) {
    // A baseline, never an event: loading, restoring or rebooting must not replay what the save already holds.
    if (seen.ready !== ready || seen.revision !== revision || seen.iteration !== iteration) setSeen({ ...now, lines: [], seq: seen.seq });
  } else if (seen.phase !== phase || seen.widgets !== widgets || seen.aegis !== aegis || seen.signal !== signal || seen.omen !== now.omen) {
    const at = gameStore.store.getState().game.simTimeSec;
    const said = eventLines(seen, now, access).map((text, index) => ({ seq: seen.seq + index + 1, text, at }));
    // A change with nothing to say (the lock falling back, say) clears the region, so a virtual cursor never
    // reads a warning that no longer holds; earlier lines are kept only within the burst window.
    const kept = seen.lines.filter((line) => at - line.at <= BURST_SEC);
    setSeen({ ...now, lines: said.length > 0 ? [...kept, ...said].slice(-KEPT_LINES) : [], seq: seen.seq + said.length });
  }
  // role=status is atomic by default, so an added line re-presents the region. react-native-web does not forward
  // aria-atomic from a View, so the burst window bounds that instead: only lines from the last BURST_SEC remain.
  return <View testID="announcer" role="status" accessibilityLiveRegion="polite" style={styles.hidden}>
    {seen.lines.map((line) => <Text key={line.seq} style={theme.text}>{line.text}</Text>)}
  </View>;
}

const styles = StyleSheet.create({
  // Read by assistive technology, not drawn: the sighted cues stay where they are (and the tab badges, F1c).
  hidden: { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', borderWidth: 0 },
});
