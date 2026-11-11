/** Phase changes recolour structural accents without changing semantic warnings.
 * Context stays stable on ticks, so static card shells remain quiet.
 */
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { Pressable as NativePressable, Text as NativeText, View as NativeView, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { useGame } from './state';
import { palette } from './theme';

const opening = { accent: palette.accent, border: palette.border };
const phases = [
  opening, opening,
  { accent: '#ffb000', border: '#856325' },
  { accent: '#00e5ff', border: '#267582' },
  { accent: '#f5c542', border: '#82743f' },
];
type MutableStyle = { -readonly [K in keyof TextStyle]: TextStyle[K] };
const Context = createContext(opening);
export function PhaseTheme({ children }: { children: ReactNode }) {
  const phase = useGame((game) => game.currentPhase);
  return <Context value={phases[phase] ?? opening}>{children}</Context>;
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
