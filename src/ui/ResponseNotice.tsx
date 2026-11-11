/**
 * Response changes remain visible until acknowledged, independently of the log.
 * Hydration and a new iteration establish a baseline rather than inventing an event.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CONTENT } from '../content';
import { selectReady, useGameValue } from '../app/selectors';
import type { LogEntry } from '../engine';
import { useGame } from './state';
import { palette, theme } from './theme';

interface Change { from: number; to: number }
function changes(logs: readonly LogEntry[], after: number, from: number, to: number): Change[] {
  const updates: Change[] = [];
  let previous = from;
  for (const entry of logs.filter((log) => log.seq > after).sort((left, right) => left.seq - right.seq)) {
    const next = CONTENT.narrative.alertLevels.findIndex((level) => level.onEnter === entry.text);
    if (next < 0 || next === previous) continue;
    updates.push({ from: previous, to: next }); previous = next;
  }
  if (previous !== to) updates.push({ from: previous, to });
  return updates;
}

export default function ResponseNotice() {
  const ready = useGameValue(selectReady);
  const level = useGame((game) => game.alertLevel);
  const iteration = useGame((game) => game.iteration);
  const logs = useGame((game) => game.logs);
  const seq = useGame((game) => game.logSeq);
  const [seen, setSeen] = useState({ ready, iteration, level, seq, queue: [] as Change[] });
  if (!ready || !seen.ready || seen.iteration !== iteration) {
    if (seen.ready !== ready || seen.iteration !== iteration || seen.level !== level || seen.seq !== seq) {
      setSeen({ ready, iteration, level, seq, queue: [] });
    }
    return null;
  }
  if (seen.level !== level || seen.seq !== seq) {
    setSeen({ ready, iteration, level, seq, queue: [...seen.queue, ...changes(logs, seen.seq, seen.level, level)] }); return null;
  }
  const update = seen.queue[0];
  if (!update) return null;
  const labels = CONTENT.narrative.alertLevels;
  return <View testID="response-notice" accessibilityRole="alert" accessibilityLiveRegion="assertive"
    style={{ borderWidth: 2, borderColor: palette.warning, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <View style={{ flex: 1 }}><Text style={theme.heading}>{update.to > update.from ? 'RESPONSE ESCALATED' : 'RESPONSE STAND-DOWN'}</Text>
      <Text style={theme.text}>{labels[update.from]?.label} → {labels[update.to]?.label}</Text>
      {seen.queue.length > 1 && <Text style={theme.muted}>{seen.queue.length} updates waiting</Text>}</View>
    <Pressable testID="response-acknowledge" accessibilityRole="button" accessibilityLabel="Acknowledge human response change"
      style={[theme.button, { paddingHorizontal: 8 }]} onPress={() => { setSeen({ ...seen, queue: seen.queue.slice(1) }); }}>
      <Text style={theme.text}>[ ACK ]</Text></Pressable>
  </View>;
}
