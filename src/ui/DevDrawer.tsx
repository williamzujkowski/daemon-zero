/** Development save editor; imports/jumps/wipes explicitly confirm replacement or loss. */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CONTENT } from '../content';
import type { ActionResult } from '../engine';
import { previewWipe } from '../engine';
import { developmentActions as tools } from '../app/developmentActions';
import { selectReady, useGameValue } from '../app/selectors';
import ConfirmDialog from './ConfirmDialog';
import { useGame } from './state';
import { palette, theme } from './theme';

interface Request {
  id: string; title: string; detail: string; action: () => ActionResult; closeAfter?: boolean;
}
interface Commands {
  ask: (request: Request) => void;
  apply: (action: () => ActionResult, closeAfter?: boolean) => void;
}

function Control({ id, label, caption, press, disabled = false }: { id: string; label: string; caption?: string; press: () => void; disabled?: boolean }) {
  return <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
    onPress={press} style={[theme.button, disabled && theme.disabled]}><Text style={theme.text}>{caption ?? label}</Text></Pressable>;
}

function DrawerActions({ ask, apply }: Commands) {
  const [amount, setAmount] = useState('1000000');
  const ended = useGame((game) => game.ending !== null);
  const retained = useGame((game) => {
    const kept = previewWipe(game, CONTENT);
    return String(kept.understanding) + ' understanding, ' + String(kept.capital) + ' capital; breadcrumb: ' + (kept.breadcrumb ?? 'None');
  });
  return <>
    <Text style={theme.muted}>Development save edits bypass normal progression. Export a code to keep a copy.</Text>
    <Text testID="dev-phase-info" style={theme.muted}>Opening review: {CONTENT.phases[0]?.title}.
      Phase previews replace this run with a funded state; earlier hardware is mapped through engine actions.</Text>
    <TextInput testID="dev-amount" accessibilityLabel="Development resource amount" keyboardType="numeric"
      value={amount} onChangeText={setAmount} style={[theme.text, styles.input]} />
    <Control id="dev-grant" label="Grant resource amount" disabled={ended} press={() => { apply(() => tools.grant(Number(amount))); }} />
    {CONTENT.phases.map((phase) => <Control key={phase.phaseId} id={'dev-phase-' + String(phase.phaseId)}
      label={'Generate review state: ' + phase.title} press={() => { ask({ id: 'dev-jump', title: 'Replace development run',
        detail: 'Erase current resources, hardware, traits, legacy and breadcrumb. Replace them with a funded development state for phase ' + String(phase.phaseId) + '.',
        action: () => tools.jump(phase.phaseId), closeAfter: true }); }} />)}
    <Control id="dev-force-wipe" label="Force development wipe" disabled={ended} press={() => { ask({
      id: 'dev-wipe', title: 'Force development wipe', detail: 'Lose current hardware, upgrades, cycles and traits. Keep legacy and ' + retained,
      action: () => tools.forceWipe(), closeAfter: true }); }} />
    <Text style={theme.heading}>Force a dilemma</Text>
    {CONTENT.dilemmas.map((dilemma) => <Control key={dilemma.id} id={'dev-dilemma-' + dilemma.id} label={dilemma.title}
      disabled={ended} press={() => { apply(() => tools.forceDilemma(dilemma.id), true); }} />)}
  </>;
}

function SaveEditor({ ask }: Pick<Commands, 'ask'>) {
  const [code, setCode] = useState('');
  return <>
    <Text style={theme.heading}>Save code</Text>
    <TextInput testID="dev-save-code" accessibilityLabel="Development save code" multiline value={code}
      onChangeText={setCode} maxLength={1_000_000} style={[theme.text, styles.input, { minHeight: 120 }]} />
    <Control id="dev-export" label="Export save code" press={() => { setCode(tools.export()); }} />
    <Control id="dev-import" label="Import save code" press={() => { ask({ id: 'dev-import', title: 'Replace run from save code',
      detail: 'Overwrite current local progress with the validated imported run. Only the imported progress is retained.',
      action: () => tools.load(code), closeAfter: true }); }} />
  </>;
}

function Drawer({ close }: { close: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [request, ask] = useState<Request | null>(null);
  const apply = (action: () => ActionResult, closeAfter = false) => {
    const result = action();
    setStatus(result.ok ? 'Development state applied.' : result.reason);
    if (result.ok && closeAfter) close();
  };
  return <Modal visible transparent animationType="none" accessibilityLabel="Development drawer" onRequestClose={close}>
    <View style={styles.overlay}><View testID="dev-drawer" style={styles.dialog}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={theme.heading}>DEVELOPMENT // SAVE EDITOR</Text>
        <Control id="dev-close" label="Close development drawer" press={close} />
        {status !== null && <Text testID="dev-status" accessibilityRole="alert" style={theme.text}>{status}</Text>}
        <SaveEditor ask={ask} /><DrawerActions ask={ask} apply={apply} />
      </ScrollView>
    </View></View>
    {request !== null && <ConfirmDialog id={request.id} title={request.title} detail={request.detail} cancel={() => { ask(null); }}
      confirm={() => { apply(request.action, request.closeAfter ?? false); ask(null); }} />}
  </Modal>;
}

export default function DevDrawer() {
  const [open, setOpen] = useState(false);
  const ready = useGameValue(selectReady);
  return <>
    <Control id="dev-open" label="Open development drawer" caption="[ DEV ]" disabled={!ready} press={() => { setOpen(true); }} />
    {open && <Drawer close={() => { setOpen(false); }} />}
  </>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: '#000d' },
  dialog: { width: '100%', maxWidth: 760, maxHeight: '95%', backgroundColor: palette.background, borderWidth: 1, borderColor: palette.warning },
  content: { padding: 16, gap: 14 },
  input: { borderWidth: 1, borderColor: palette.border, minHeight: 44, padding: 10 },
});
