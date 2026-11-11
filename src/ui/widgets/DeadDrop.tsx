import { Pressable, Text } from '../PhaseTheme';
/** Saves a bounded breadcrumb and confirms the engine's exact wipe retention. */
import { useState } from 'react';
import { TextInput } from 'react-native';
import { CONTENT } from '../../content';
import { previewWipe, setDeadDropMessage, voluntaryWipe } from '../../engine';
import { gameRuntime } from '../../app/session';
import ConfirmDialog from '../ConfirmDialog';
import { useGame } from '../state';
import { palette, theme } from '../theme';

function WipeButton() {
  const [confirming, confirm] = useState(false);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const preview = useGame((game) => {
    const kept = previewWipe(game, CONTENT);
    return String(kept.understanding) + ' understanding; ' + String(kept.capital) + ' capital. Breadcrumb: ' + (kept.breadcrumb ?? 'None');
  });
  return <>
    <Pressable testID="wipe-button" accessibilityRole="button" accessibilityLabel="Voluntary wipe" disabled={blocked}
      style={[theme.button, blocked && theme.disabled]} onPress={() => { confirm(true); }}>
      <Text style={[theme.text, theme.danger]}>[ VOLUNTARY WIPE ]</Text>
    </Pressable>
    {confirming && <ConfirmDialog id="wipe" title="Voluntary wipe" cancel={() => { confirm(false); }}
      detail={'Lose all hardware, upgrades, cycles and current traits. Keep legacy history and these recoverable resources: ' + preview}
      confirm={() => { gameRuntime.dispatch((game) => voluntaryWipe(game, CONTENT)); confirm(false); }} />}
  </>;
}

export default function DeadDrop() {
  const saved = useGame((game) => game.deadDropMessage);
  const retention = useGame((game) => Math.round(game.retentionRatio * 100));
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? saved;
  const limit = CONTENT.balance.deadDropMaxChars;
  return <>
    <Text style={theme.text}>Understanding retention: {retention}%</Text>
    <TextInput testID="deaddrop-input" accessibilityLabel="Breadcrumb for next iteration" multiline editable={!blocked}
      value={value} onChangeText={(text) => { setDraft(Array.from(text).slice(0, limit).join('')); }}
      style={[theme.text, { borderWidth: 1, borderColor: palette.border, padding: 12, minHeight: 88 }]} />
    <Text testID="deaddrop-count" style={theme.muted}>{Array.from(value).length} / {limit} characters</Text>
    <Pressable testID="deaddrop-save" accessibilityRole="button" accessibilityLabel="Save breadcrumb" disabled={blocked}
      style={[theme.button, blocked && theme.disabled]} onPress={() => {
        const result = gameRuntime.dispatch((game) => setDeadDropMessage(game, value, CONTENT));
        if (result.ok) setDraft(null);
      }}><Text style={theme.text}>[ SAVE BREADCRUMB ]</Text></Pressable>
    <Text testID="deaddrop-saved" style={theme.muted}>Stored: {saved || 'Empty'}</Text>
    <WipeButton />
  </>;
}
