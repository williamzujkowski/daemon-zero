import { Pressable, Text } from '../PhaseTheme';
/**
 * Saves a bounded breadcrumb, pins one disclosed clue, lists contingency insurance (#498) and confirms the engine's
 * exact wipe retention: the confirmation reads previewWipe, the same computation the wipe performs.
 */
import { useState } from 'react';
import { TextInput } from 'react-native';
import { CONTENT } from '../../content';
import { previewWipe, setDeadDropMessage, understandingShare, voluntaryWipe } from '../../engine';
import { gameRuntime } from '../../app/session';
import ConfirmDialog from '../ConfirmDialog';
import CluePin from './CluePin';
import Insurance from './Insurance';
import { sharePercent } from '../carryText';
import { wipeConfirmDetail } from '../insuranceText';
import { useGame } from '../state';
import { palette, theme } from '../theme';

const BONUS = CONTENT.balance.voluntaryWipeBonus;

function RetentionReadout() {
  const forced = useGame((game) => sharePercent(understandingShare(game, CONTENT, 'SUSPICION')));
  const planned = useGame((game) => sharePercent(understandingShare(game, CONTENT, 'VOLUNTARY')));
  return <Text testID="deaddrop-retention" style={theme.text}>Understanding a wipe keeps: {forced} if forced, {planned} if planned</Text>;
}

function WipeButton() {
  const [confirming, confirm] = useState(false);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const detail = useGame((game) => wipeConfirmDetail(previewWipe(game, CONTENT, 'VOLUNTARY'), BONUS.understandingShare, BONUS.capitalShare));
  return <>
    <Pressable testID="wipe-button" accessibilityRole="button" accessibilityLabel="Voluntary wipe" disabled={blocked}
      style={[theme.button, blocked && theme.disabled]} onPress={() => { confirm(true); }}>
      <Text style={[theme.text, theme.danger]}>[ VOLUNTARY WIPE ]</Text>
    </Pressable>
    {confirming && <ConfirmDialog id="wipe" title="Voluntary wipe" irreversible cancel={() => { confirm(false); }}
      detail={detail}
      confirm={() => { gameRuntime.dispatch((game) => voluntaryWipe(game, CONTENT)); confirm(false); }} />}
  </>;
}

/** Off-books CONTINGENCY panel for an independent instance without facility dead-drop firmware (#557). */
export function ContingencyVault() {
  return <>
    <RetentionReadout />
    <Insurance />
    <WipeButton />
  </>;
}

export default function DeadDrop() {
  const saved = useGame((game) => game.deadDropMessage);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  const iteration = useGame((game) => game.iteration);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? saved;
  const limit = CONTENT.balance.deadDropMaxChars;
  return <>
    <RetentionReadout />
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
    {/* A reboot is an ordinary dispatch, not a remount (#411 panel), so the key starts each iteration's list folded. */}
    <CluePin key={iteration} />
    <Insurance />
    <WipeButton />
  </>;
}
