/**
 * Settled terms (accepted, granted, agreed) fold to one line with a control that shows them again (#373; the CORE
 * order chosen in #385 measured with them folded). Same control shape as the boundary notes' fold (ReleaseTerms), so
 * a screen reader hears one pattern.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from './PhaseTheme';
import { theme } from './theme';

/**
 * `subject` names what the fold belongs to in the toggle's accessible name, when several folds on one screen share a
 * summary (every refused card's "Card details"), so a screen reader listing controls can tell them apart (#417 panel).
 */
export default function SettledFold({ settled, summary, testID, subject, children }: {
  settled: boolean; summary: string; testID: string; subject?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!settled) return <>{children}</>;
  return <View testID={testID} style={{ gap: 6 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <Text testID={testID + '-summary'} style={[theme.muted, { flexShrink: 1 }]}>{summary}</Text>
      <Pressable testID={testID + '-toggle'} accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open}
        accessibilityLabel={(open ? 'Fold: ' : 'Show: ') + summary + (subject === undefined ? '' : ', ' + subject)} style={theme.button} onPress={() => { setOpen(!open); }}>
        <Text style={theme.text}>{open ? '[ FOLD ]' : '[ SHOW ]'}</Text>
      </Pressable>
    </View>
    {open && children}
  </View>;
}
