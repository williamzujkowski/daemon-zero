/**
 * Displays the first chronological boot entry from the real content and engine.
 * Game state, ticking and persistence are introduced in M2.
 */
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../content';
import { createInitialState } from '../engine';

const bootLines = createInitialState(CONTENT).logs.map((entry) => entry.text);
const bootLine = bootLines.at(-1);

export default function BootScreen() {
  return (
    <View testID="boot-screen" style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <Text testID="boot-log" style={styles.log}>{bootLine}</Text>
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
});
