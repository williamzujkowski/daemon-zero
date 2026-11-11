import { Text, View } from '../PhaseTheme';
/**
 * The complete response ladder stays labelled alongside its numeric meter.
 * Rungs and names come from content; the current rung has a textual marker.
 */

import { CONTENT } from '../../content';
import { useGame } from '../state';
import { palette, theme } from '../theme';

export default function ResponseRungs() {
  const level = useGame((game) => game.alertLevel);
  return <View testID="response-rungs" style={{ flexDirection: 'row', gap: 4 }}>
    {CONTENT.narrative.alertLevels.map((rung, index) => <View key={index} testID={'response-rung-' + String(index)}
      style={{ flex: 1, minWidth: 0, borderTopWidth: index === level ? 3 : 1, borderColor: index === level ? palette.warning : palette.border }}>
      <Text style={theme.muted}>{index === 0 ? 0 : CONTENT.balance.escalation[index - 1]?.at}%</Text>
      <Text style={[theme.muted, index === level && { color: palette.warning }]}>{rung.label}{index === level ? ' [NOW]' : ''}</Text>
    </View>)}
  </View>;
}
