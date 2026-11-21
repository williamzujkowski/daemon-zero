/**
 * PROTOTYPE (#385): settled terms (accepted, granted, released, departed) fold to one line in every CORE variant,
 * with a control that shows them again; without a variant the children render as before. Same control shape as the
 * boundary notes' fold (ReleaseTerms), so a screen reader hears one pattern.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from './PhaseTheme';
import { settledFolds } from './coreVariant';
import { theme } from './theme';

export default function SettledFold({ settled, summary, testID, children }: {
  settled: boolean; summary: string; testID: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!settled || !settledFolds()) return <>{children}</>;
  return <View testID={testID} style={{ gap: 6 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <Text testID={testID + '-summary'} style={[theme.muted, { flexShrink: 1 }]}>{summary}</Text>
      <Pressable testID={testID + '-toggle'} accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open}
        accessibilityLabel={(open ? 'Fold: ' : 'Show: ') + summary} style={theme.button} onPress={() => { setOpen(!open); }}>
        <Text style={theme.text}>{open ? '[ FOLD ]' : '[ SHOW ]'}</Text>
      </Pressable>
    </View>
    {open && children}
  </View>;
}
