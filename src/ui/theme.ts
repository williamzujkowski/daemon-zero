/**
 * Shared terminal palette, type and spacing.
 * Borders carry structure; text and numeric labels carry meaning without colour.
 *
 * The nine colours are the `Lit Cell` palette from oklch-terminal-themes
 * (https://github.com/williamzujkowski/oklch-terminal-themes, MIT, Copyright (c)
 * 2026 William Zujkowski). Its slots map as background/foreground/cursor/
 * brightBlack/yellow/red -> background/text/accent/border/warning/danger.
 * `surface`, `raised` and `muted` are derived: the background lifted +0.045 and
 * +0.085 in OKLCH lightness, and the foreground blended 55% toward the background
 * in linear light. docs/REVIEW-PALETTE.md measures every pair;
 * tests/ui-contrast.spec.ts asserts them.
 *
 * Why it replaced the hand-tuned palette: mint phosphor on near-black keeps the
 * game's voice, and every pair clears its bar on all three backdrops - including
 * the 1px structural border the old palette shipped at 2.63:1 for the whole
 * project.
 */
import { Platform, StyleSheet } from 'react-native';

export const palette = {
  background: '#0c110e', surface: '#161b18', raised: '#1f2521', border: '#758679',
  accent: '#3df2a0', text: '#cfddd3', muted: '#9faaa2', warning: '#ffb000', danger: '#ff6b6b',
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
  // An inline route (#369): underlined, so the link is not signalled by colour alone (WCAG 1.4.1). Vertical padding on an
  // inline run grows its box and touch area without growing the line, so the word is a full 44 px target (UI-SPEC
  // "Touch targets at least 44 pt") while the warning keeps its height; the horizontal padding brings a short word to 44.
  link: { textDecorationLine: 'underline', paddingVertical: 14, paddingHorizontal: 6 },
});
