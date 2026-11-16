/** One disclosed event previews the feed; history gets its own bounded virtual viewport. */
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Modal, StyleSheet, useWindowDimensions } from 'react-native';
import KernelLog from './KernelLog';
import DisclosureText from './DisclosureText';
import { Pressable, Text, View } from './PhaseTheme';
import { selectLatestLog, useGameValue } from '../app/selectors';
import { useUtilityScope } from './useUtilityMenu';
import { palette, theme } from './theme';
import { SafeOverlay } from './safeArea';
import { layoutFor } from './layout';

export default function LogDock() {
  const { scope, disabled } = useUtilityScope();
  const [opened, setOpened] = useState<string | null>(null);
  const trigger = useRef<ComponentRef<typeof Pressable>>(null);
  const restoreFocus = useRef(false);
  const latest = useGameValue(selectLatestLog) || 'No kernel entries.';
  const { width, height } = useWindowDimensions();
  // The phone tier has no room for a 57px band: its 44px tap target sets the floor, so a
  // one-line variant saves 1px (measured). The band is dropped there - and only there,
  // because the tablet and desktop chrome sits outside the scroll and the band costs the
  // pane nothing - while the history moves into the utility menu (nexus vote, 6 of 6).
  const compact = layoutFor(width, height).mode === 'mobile';
  const open = opened === scope && !disabled;
  if (opened !== null && !open) setOpened(null);
  useEffect(() => {
    if (!open && restoreFocus.current) { restoreFocus.current = false; trigger.current?.focus(); }
  }, [open]);
  const close = () => { restoreFocus.current = true; setOpened(null); };
  if (compact) return null;
  return <View testID="kernel-dock" style={styles.preview}>
    <View style={styles.row}><View style={styles.summary}>
      <Text accessibilityRole="header" style={theme.heading}>KERNEL // LIVE</Text>
      <DisclosureText testID="kernel-preview" numberOfLines={1} ellipsizeMode="tail" style={theme.muted}>{latest}</DisclosureText>
    </View>
      <Pressable ref={trigger} testID="kernel-size-toggle" accessibilityRole="button" accessibilityLabel="[ EXPAND ] Expand kernel log"
        accessibilityState={{ expanded: open, disabled }} aria-expanded={open} disabled={disabled}
        style={theme.button} onPress={() => { setOpened(scope); }}><Text style={theme.text}>[ EXPAND ]</Text></Pressable>
    </View>
    {open && <History close={close} />}
  </View>;
}

function History({ close }: { close: () => void }) {
  const focus = useRef<ComponentRef<typeof Pressable>>(null);
  useEffect(() => { focus.current?.focus(); }, []);
  return <Modal visible transparent animationType="none" accessibilityLabel="Kernel log history" onRequestClose={close}>
    <SafeOverlay padding={12} style={styles.overlay}><View testID="kernel-history" style={styles.history}>
      <View style={styles.row}><Text accessibilityRole="header" style={[theme.heading, styles.title]}>KERNEL // HISTORY</Text>
        <Pressable ref={focus} testID="kernel-close" accessibilityRole="button" accessibilityLabel="Close kernel log"
          style={theme.button} onPress={close}><Text style={theme.text}>[ CLOSE ]</Text></Pressable>
      </View><KernelLog />
    </View></SafeOverlay>
  </Modal>;
}

const styles = StyleSheet.create({
  preview: { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0, paddingHorizontal: 16, paddingVertical: 6, gap: 4 },
  // The band is only rendered above the compact breakpoint now, so the mobile row-break
  // that used to force it full width is gone with it.
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  summary: { flex: 1, minWidth: 0, gap: 4 },
  title: { flexGrow: 1, flexShrink: 1 },
  overlay: { flex: 1, backgroundColor: '#000e', alignItems: 'center', justifyContent: 'center' },
  history: { width: '100%', maxWidth: 900, height: '85%', minHeight: 100, backgroundColor: palette.background,
    borderWidth: 1, borderColor: palette.border, padding: 12 },
});
