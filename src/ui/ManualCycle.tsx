import { useWindowDimensions } from 'react-native';
import { Pressable, Text, View } from './PhaseTheme';
import { COLUMN_MIN_WIDTH } from './layout';
/**
 * Keeps the initial probe available without exposing locked resource readouts.
 * All input is routed through the app runtime and the public engine action.
 *
 * Once automation dwarfs a click the control demotes itself: measured on the shipped
 * fixtures, cycles/s is 0 at tick 0, 1.5-33 through the opening and phase 1, then
 * 1720 in phase 3 and 362k-486k from phase 4 — so past the threshold a manual click
 * worth one cycle is competing with thousands per second and should not hold the
 * primary slot in the purchase feed. It is demoted rather than hidden (a nexus
 * consensus_vote chose demote-to-inline-line over hiding, 4 of 5 selecting seats):
 * the verb stays, the prominence does not.
 */
import { recordManualInput } from '../app/renderCounts';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { registerPrimaryAction } from './primaryFocus';

import { CONTENT } from '../content';
import { manualCycle } from '../engine';
import { gameRuntime } from '../app/session';
import { selectReady, useGameValue } from '../app/selectors';
import { useGame } from './state';
import { StyleSheet } from 'react-native';
import { theme } from './theme';
import { resourceWidgets } from './registry/widgetRegistry';

/** Cycles/s at which a manual click stops being worth a primary control. */
export const MANUAL_CYCLE_DEMOTE_RATE = 200;

export function shouldDemoteManualCycle(cyclesPerSec: number): boolean {
  return cyclesPerSec >= MANUAL_CYCLE_DEMOTE_RATE;
}

export default function ManualCycle() {
  const ready = useGameValue(selectReady);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const iteration = useGame((game) => game.iteration);
  const counter = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.cycles));
  const demoted = useGame((game) => shouldDemoteManualCycle(game.rates.cyclesPerSec));
  const [feedback, setFeedback] = useState({ iteration, count: 0 });
  // A closing dialog returns focus here rather than to the page body (#364).
  const self = useRef<ComponentRef<typeof Pressable>>(null);
  useEffect(() => registerPrimaryAction({ focus: () => { self.current?.focus(); } }), []);
  const count = feedback.iteration === iteration ? feedback.count : 0;
  // The accessible name contains the visible text either way (WCAG 2.5.3).
  // At the column tiers the control otherwise stretches the whole core column (measured
  // 730px at 1440) and reads as a green bar rather than a button; the phone keeps the full
  // width because there the width is the touch target.
  const wide = useWindowDimensions().width >= COLUMN_MIN_WIDTH;
  const label = demoted ? '[ cycle ] +1 — execute clock cycle' : '[ EXECUTE_CLOCK_CYCLE ] Execute clock cycle';
  return <View style={{ gap: 6 }}><Pressable ref={self} testID="manual-cycle" accessibilityRole="button" accessibilityLabel={label}
    disabled={!ready || blocked} style={[theme.button, demoted && styles.demoted, wide && !demoted && styles.wide, (!ready || blocked) && theme.disabled]}
    onPress={() => {
      const result = gameRuntime.dispatch((game) => manualCycle(game, CONTENT));
      if (typeof __DEV__ !== 'undefined' && __DEV__) recordManualInput(result.ok);
      if (result.ok) setFeedback({ iteration, count: count + 1 });
    }}>
    {demoted
      ? <Text testID="manual-cycle-inline" style={theme.muted}>[ cycle ] +1</Text>
      : <Text style={theme.heading}>[ EXECUTE_CLOCK_CYCLE ]</Text>}
  </Pressable>{!counter && count > 0 && <Text testID="manual-feedback" accessibilityLiveRegion="polite"
    role="status" style={theme.muted}>Manual instructions committed: {count}</Text>}</View>;
}

const styles = StyleSheet.create({
  // Not full width, muted label, tighter padding: the control stops claiming the
  // primary slot without dropping below the 44px touch minimum.
  demoted: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4 },
  wide: { alignSelf: 'flex-start', maxWidth: 360 },
});
