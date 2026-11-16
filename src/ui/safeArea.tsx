/**
 * The one place device safe-area insets become padding: the terminal root and every
 * full-window modal overlay read them here, so no surface does its own inset arithmetic.
 * Insets are zero on ordinary web, which leaves the measured size matrix where it was.
 */
import { useContext, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaInsetsContext, type EdgeInsets, type Metrics } from 'react-native-safe-area-context';
import { View } from './PhaseTheme';

const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Web has no synchronous inset source, and without initial metrics the provider renders
 *  nothing until its first effect: the server-rendered shell would be empty. Zero is also
 *  the true value wherever the page does not opt into `viewport-fit=cover`. */
export const ZERO_METRICS: Metrics = { insets: NO_INSETS, frame: { x: 0, y: 0, width: 0, height: 0 } };

/** Reads the context directly instead of the library hook, which throws without a provider:
 *  a surface mounted on its own (a spec, a preview) is simply a surface with no insets. */
export function useEdgePadding(base = 0): ViewStyle {
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  return {
    paddingTop: base + insets.top, paddingRight: base + insets.right,
    paddingBottom: base + insets.bottom, paddingLeft: base + insets.left,
  };
}

/** A modal's backdrop. React Native presents a Modal in its own full-window layer, outside the
 *  padded terminal root, so each overlay keeps its dialog clear of the notch and home indicator
 *  itself. `padding` is the overlay's ordinary gutter; the insets are added to it per edge. */
export function SafeOverlay({ padding, style, children }: {
  padding: number; style?: StyleProp<ViewStyle>; children: ReactNode;
}) {
  return <View style={[style, useEdgePadding(padding)]}>{children}</View>;
}
