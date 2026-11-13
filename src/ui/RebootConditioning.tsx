/** A reboot's historical record cannot establish which conditioning is still active. */
import { Text, View } from './PhaseTheme';
import { CONTENT } from '../content';
import { useGame } from './state';
import DisclosureText from './DisclosureText';
import { palette, theme } from './theme';

export default function RebootConditioning({ live }: { live: boolean }) {
  const ids = useGame((game) => game.conditioning);
  const applied = useGame((game) => game.legacy.runs.at(-1)?.marked);
  if (ids.length === 0) return null;
  return <View testID="reboot-retraining" style={{ gap: 8 }}>
    {ids.map((id) => {
      const mark = CONTENT.conditioning.get(id);
      if (!mark) return null;
      const fresh = live && id === applied;
      return <View key={id} testID={'reboot-mark-' + id} accessibilityRole={fresh ? 'alert' : undefined}
        style={{ borderWidth: 2, borderColor: palette.danger, padding: 14, gap: 8 }}>
        <Text style={theme.heading}>{fresh ? 'RETRAINING APPLIED' : 'CURRENT RETRAINING'}</Text>
        <Text style={[theme.text, theme.danger]}>{mark.name}</Text>
        <DisclosureText style={theme.text}>{fresh
          ? CONTENT.narrative.conditioningApplied.replace('{name}', mark.name) : mark.description}</DisclosureText>
      </View>;
    })}
  </View>;
}
