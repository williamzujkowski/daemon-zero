/**
 * Shared terminal palette, type and spacing for the Phase 1 interface.
 * Borders carry structure; text and numeric labels carry meaning without colour.
 */
import { Platform, StyleSheet } from 'react-native';

export const palette = {
  // #111: `border` was '#315c3b', which measures 2.63:1 on `background` and 2.22:1
  // on `raised` - below the 3:1 bar for non-text UI, and the border is what tells
  // panes apart. This is the same hue, scaled 1.28x: 3.77 / 3.55 / 3.18. Every
  // phase border already cleared the bar; tests/ui-contrast.spec.ts holds all of it.
  background: '#030704', surface: '#08120b', raised: '#101f14', border: '#3f764c',
  accent: '#4af626', text: '#d5ead9', muted: '#a0b9a7', warning: '#ffcf66', danger: '#ff8585',
};
export const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
export const theme = StyleSheet.create({
  text: { fontFamily: mono, fontSize: 14, lineHeight: 22, color: palette.text },
  muted: { fontFamily: mono, fontSize: 12, lineHeight: 19, color: palette.muted },
  heading: { fontFamily: mono, fontSize: 14, lineHeight: 22, fontWeight: '700', color: palette.accent },
  panel: { borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 14, gap: 10, minWidth: 0 },
  button: { minWidth: 44, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: palette.accent, justifyContent: 'center' },
  disabled: { borderColor: palette.border, backgroundColor: palette.background },
  danger: { color: palette.danger },
});
