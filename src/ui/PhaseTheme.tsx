/** Phase changes recolour structural accents without changing semantic warnings.
 * Context stays stable on ticks, so static card shells remain quiet.
 */
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { Pressable as NativePressable, Text as NativeText, View as NativeView, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { useGame } from './state';
import { palette } from './theme';

const opening = { accent: palette.accent, border: palette.border };
/**
 * Phase accents, re-derived on the Lit Cell base (#124). Phases 2 and 4 used to be
 * amber and gold - 0 and 3 degrees from the warning colour, so a warning surface
 * differed from an ordinary accent surface only by border weight. They are now
 * violet and magenta: every accent keeps 30+ degrees of hue separation from
 * `warning` and `danger` and from each other, which tests/ui-contrast.spec.ts
 * asserts. Phase 5 stays near-white and carries its state by brightness, not hue.
 * Every border clears 3:1 on `raised`, the lightest plate it can land on.
 */
export const PHASE_TOKENS = [
  opening, opening,
  { accent: '#b98cff', border: '#776c9d' },
  { accent: '#00e5ff', border: '#477a88' },
  { accent: '#ff6ec7', border: '#96647c' },
  { accent: '#e2e8f0', border: '#73869c' },
];
type MutableStyle = { -readonly [K in keyof TextStyle]: TextStyle[K] };
const Context = createContext(opening);
export function PhaseTheme({ children }: { children: ReactNode }) {
  const phase = useGame((game) => game.currentPhase);
  return <Context value={PHASE_TOKENS[phase] ?? opening}>{children}</Context>;
}
function useColour(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  const colours = useContext(Context);
  const flat = StyleSheet.flatten(style), overrides: MutableStyle = {};
  if (!flat) return style;
  if (flat.color === palette.accent) overrides.color = colours.accent;
  for (const key of ['borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'] as const) {
    if (flat[key] === palette.accent) overrides[key] = colours.accent;
    if (flat[key] === palette.border) overrides[key] = colours.border;
  }
  return [style, overrides];
}
export function Text(props: ComponentProps<typeof NativeText>) {
  return <NativeText {...props} style={useColour(props.style)} />;
}
export function View(props: ComponentProps<typeof NativeView>) {
  return <NativeView {...props} style={useColour(props.style)} />;
}
export function Pressable(props: Omit<ComponentProps<typeof NativePressable>, 'style'> & { style?: StyleProp<TextStyle> }) {
  return <NativePressable {...props} style={useColour(props.style)} />;
}
