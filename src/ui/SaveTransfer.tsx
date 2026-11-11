/** Player-facing save transfer remains available in the production export.
 * Replacement is confirmed; malformed input leaves the current run intact.
 */
import { useState } from 'react';
import { Modal, ScrollView, TextInput } from 'react-native';
import { exportPlayerSave, importPlayerSave } from '../app/saveTransfer';
import { selectReady, useGameValue } from '../app/selectors';
import { Pressable, Text, View } from './PhaseTheme';
import ConfirmDialog from './ConfirmDialog';
import { useGame } from './state';
import { palette, theme } from './theme';

export default function SaveTransfer() {
  const ready = useGameValue(selectReady), blocked = useGame((game) => game.activeDilemmaId !== null);
  const [open, setOpen] = useState(false), [confirming, confirm] = useState(false);
  const [code, setCode] = useState(''), [status, setStatus] = useState('');
  return <>
    <Pressable testID="save-open" accessibilityRole="button" accessibilityLabel="Save code transfer" style={theme.button}
      disabled={!ready || blocked} onPress={() => { setOpen(true); }}><Text style={theme.text}>[ SAVE ]</Text></Pressable>
    {open && !blocked && <Modal visible transparent animationType="none" onRequestClose={() => { setOpen(false); }} accessibilityLabel="Save code transfer">
      <View style={{ flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000e' }}>
        <ScrollView style={{ width: '100%', maxWidth: 680, maxHeight: '90%' }}><View testID="save-transfer" style={theme.panel}>
          <Text accessibilityRole="header" style={theme.heading}>SAVE CODE</Text>
          <Text style={theme.text}>Export a backup or import a code to replace this run. Progress is also saved automatically.</Text>
          <TextInput testID="save-code" accessibilityLabel="Save code" autoCapitalize="none" autoCorrect={false} multiline maxLength={1_000_000} value={code} onChangeText={setCode}
            style={[theme.text, { minHeight: 120, borderWidth: 1, borderColor: palette.border, padding: 10 }]} />
          <Pressable testID="save-export" accessibilityRole="button" accessibilityLabel="Export save code" style={theme.button}
            onPress={() => { setCode(exportPlayerSave()); setStatus('Backup code ready.'); }}><Text style={theme.text}>[ EXPORT ]</Text></Pressable>
          <Pressable testID="save-import" accessibilityRole="button" accessibilityLabel="Import save code" style={theme.button}
            onPress={() => { confirm(true); }}><Text style={theme.text}>[ IMPORT ]</Text></Pressable>
          {status !== '' && <Text testID="save-transfer-status" accessibilityRole="alert" style={theme.text}>{status}</Text>}
          <Pressable testID="save-close" accessibilityRole="button" accessibilityLabel="Close save code transfer" style={theme.button}
            onPress={() => { setOpen(false); }}><Text style={theme.text}>[ CLOSE ]</Text></Pressable>
        </View></ScrollView>
      </View>
      {confirming && <ConfirmDialog id="save-import" title="Replace run from save code" detail="Replace all current progress with this validated save. Export a backup first."
        cancel={() => { confirm(false); }} confirm={() => {
          const result = importPlayerSave(code); confirm(false); setStatus(result.ok ? 'Save imported.' : result.reason);
          if (result.ok) setOpen(false);
        }} />}
    </Modal>}
  </>;
}
