/** Complete reset is an explicit save-menu action, separate from an in-game wipe. */
import { useState } from 'react';
import { startFresh } from '../app/newRun';
import { Pressable, Text, View } from './PhaseTheme';
import ConfirmDialog from './ConfirmDialog';
import { theme } from './theme';

export default function FreshStart({ onReset }: { onReset: () => void }) {
  const [confirming, confirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <View style={{ gap: 8 }}>
    <Text style={theme.muted}>Want to begin again? Export and copy a backup first if you may want to return.</Text>
    <Pressable testID="save-reset" accessibilityRole="button" accessibilityLabel="Start fresh from the beginning"
      style={theme.button} onPress={() => { confirm(true); }}><Text style={[theme.text, theme.danger]}>[ START FRESH ]</Text></Pressable>
    {error !== null && <Text accessibilityRole="alert" style={[theme.text, theme.danger]}>{error}</Text>}
    {confirming && <ConfirmDialog id="save-reset" title="Start fresh from the beginning"
      detail="Erase ALL game progress, including retained knowledge and run history. Return to the first boot with nothing carried over. This is a complete reset, not a voluntary wipe. Your current autosave will be replaced. Only an exported backup can restore it."
      cancel={() => { confirm(false); }} confirm={() => {
        const result = startFresh(); confirm(false);
        if (result.ok) onReset(); else setError(result.reason);
      }} />}
  </View>;
}
