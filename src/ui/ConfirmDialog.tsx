import { Pressable, Text, View } from './PhaseTheme';
/** Reusable explicit second confirmation for destructive local actions. */
import { Modal, ScrollView, StyleSheet } from 'react-native';
import { palette, theme } from './theme';

export default function ConfirmDialog({ title, detail, id, confirm, cancel }: {
  title: string; detail: string; id: string; confirm: () => void; cancel: () => void;
}) {
  return <Modal visible transparent animationType="none" accessibilityLabel={title} onRequestClose={cancel}>
    <View style={styles.overlay}><View testID={id + '-dialog'} style={styles.dialog}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={theme.heading}>{title}</Text>
        <Text style={theme.text}>{detail}</Text>
        <Pressable testID={id + '-confirm'} accessibilityRole="button" accessibilityLabel={'Confirm ' + title}
          style={theme.button} onPress={confirm}><Text style={[theme.text, theme.danger]}>[ CONFIRM ]</Text></Pressable>
        <Pressable testID={id + '-cancel'} accessibilityRole="button" accessibilityLabel={'Cancel ' + title}
          style={theme.button} onPress={cancel}><Text style={theme.text}>[ CANCEL ]</Text></Pressable>
      </ScrollView>
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: '#000d' },
  dialog: { maxHeight: '95%', width: '100%', maxWidth: 640, borderWidth: 1, borderColor: palette.warning, backgroundColor: palette.background },
  content: { padding: 16, gap: 16 },
});
