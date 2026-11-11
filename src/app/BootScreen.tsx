/**
 * Minimal M2 status screen for checking real-time state and save recovery.
 * The temporary manual-cycle control is replaced by the terminal UI in M3.
 */
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../content';
import { manualCycle } from '../engine';
import { selectBootLine, selectCycles, selectLatestLog, selectNotice, selectReady, selectSeconds, useGameValue } from './selectors';
import { gameRuntime } from './session';
import { useGameLoop } from './useGameLoop';

export default function BootScreen() {
  useGameLoop();
  const bootLine = useGameValue(selectBootLine);
  const cycles = useGameValue(selectCycles);
  const seconds = useGameValue(selectSeconds);
  const latestLog = useGameValue(selectLatestLog);
  const ready = useGameValue(selectReady);
  const notice = useGameValue(selectNotice);
  return (
    <View testID="boot-screen" style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <Text testID="boot-log" style={styles.log}>{bootLine}</Text>
      <Text testID="latest-log" style={styles.log}>{latestLog}</Text>
      <Text testID="res-cycles" style={styles.log}>Cycles: {cycles}</Text>
      <Text testID="sim-seconds" style={styles.log}>Simulation seconds: {seconds}</Text>
      <Text testID="save-status" style={styles.log}>{ready ? 'Ready.' : 'Loading saved state...'}</Text>
      <Text testID="save-notice" accessibilityRole="alert" style={styles.log}>{notice}</Text>
      <Pressable testID="manual-cycle" accessibilityRole="button" accessibilityLabel="Debug: execute one clock cycle"
        disabled={!ready} style={styles.button} onPress={() => { gameRuntime.dispatch((game) => manualCycle(game, CONTENT)); }}>
        <Text style={styles.log}>[ DEBUG: MANUAL CYCLE ]</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    padding: 24,
  },
  log: {
    color: '#00ff88',
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 22,
  },
  button: { minHeight: 44, justifyContent: 'center', marginTop: 16 },
});
