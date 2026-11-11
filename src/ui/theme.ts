/**
 * Shared terminal palette, type and spacing for the Phase 1 interface.
 * Borders carry structure; text and numeric labels carry meaning without colour.
 */
import { Platform, StyleSheet } from 'react-native';

export const palette = {
  background: '#030704', surface: '#08120b', raised: '#101f14', border: '#315c3b',
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
