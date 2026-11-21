import { Pressable, Text, View } from './PhaseTheme';
/** Reusable explicit second confirmation for destructive local actions. */
import { Modal, ScrollView, StyleSheet } from 'react-native';
import { palette, theme } from './theme';
import { SafeOverlay } from './safeArea';
import { HeadingLevel } from './headingLevel';
import { NO_UNDO_TEXT } from './oneWayText';

export default function ConfirmDialog({ title, detail, id, confirm, cancel, irreversible = false }: {
  title: string; detail: string; id: string; confirm: () => void; cancel: () => void;
  /** The action has no undo; the dialog says so in its own line (#372). */
  irreversible?: boolean;
}) {
  // A dialog opened from inside a widget (the dead drop's wipe) leaves the widget's outline: its title keeps the
  // dialog's own level rather than taking the widget body's (headingLevel.tsx).
  return <Modal visible transparent animationType="none" accessibilityLabel={title} onRequestClose={cancel}>
    <HeadingLevel level={undefined}>
    <SafeOverlay padding={16} style={styles.overlay}><View testID={id + '-dialog'} style={styles.dialog}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={theme.heading}>{title}</Text>
        <Text style={theme.text}>{detail}</Text>
        {irreversible && <Text testID={id + '-no-undo'} style={[theme.text, theme.danger]}>{NO_UNDO_TEXT}</Text>}
        {/* The safe way out comes first (#372): the red CONFIRM used to lead, the same size as CANCEL. */}
        <Pressable testID={id + '-cancel'} accessibilityRole="button" accessibilityLabel={'Cancel ' + title}
          style={theme.button} onPress={cancel}><Text style={theme.text}>[ CANCEL ]</Text></Pressable>
        <Pressable testID={id + '-confirm'} accessibilityRole="button" accessibilityLabel={'Confirm ' + title}
          style={theme.button} onPress={confirm}><Text style={[theme.text, theme.danger]}>[ CONFIRM ]</Text></Pressable>
      </ScrollView>
    </View></SafeOverlay>
    </HeadingLevel>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000d' },
  dialog: { maxHeight: '95%', width: '100%', maxWidth: 640, borderWidth: 1, borderColor: palette.warning, backgroundColor: palette.background },
  content: { padding: 16, gap: 16 },
});
