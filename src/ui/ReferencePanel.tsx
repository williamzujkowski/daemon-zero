/** Secondary reference material stays available without repeating the live feed. */
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from './PhaseTheme';
import { theme } from './theme';

export default function ReferencePanel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={{ gap: 10 }}>
    <Pressable testID={'reference-' + id} accessibilityRole="button" accessibilityLabel={title}
      accessibilityState={{ expanded }} aria-expanded={expanded} style={theme.button} onPress={() => { setExpanded(!expanded); }}>
      <Text style={theme.heading}>{expanded ? '[ − ] ' : '[ + ] '}{title}</Text>
    </Pressable>
    {expanded && children}
  </View>;
}
