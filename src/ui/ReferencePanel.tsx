/** Secondary reference material stays available without repeating the live feed. */
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from './PhaseTheme';
import { theme } from './theme';

/**
 * With `level`, the panel titles a section (#302): its toggle sits inside a heading, the disclosure pattern that
 * keeps both the button and the heading (a heading inside a button would lose its role).
 */
export default function ReferencePanel({ id, title, level, children }: { id: string; title: string; level?: number; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = <Pressable testID={'reference-' + id} accessibilityRole="button" accessibilityLabel={(expanded ? '[ − ] ' : '[ + ] ') + title}
    accessibilityState={{ expanded }} aria-expanded={expanded} style={theme.button} onPress={() => { setExpanded(!expanded); }}>
    <Text style={theme.heading}>{expanded ? '[ − ] ' : '[ + ] '}{title}</Text>
  </Pressable>;
  return <View style={{ gap: 10 }}>
    {level === undefined ? toggle : <View accessibilityRole="header" aria-level={level}>{toggle}</View>}
    {expanded && children}
  </View>;
}
