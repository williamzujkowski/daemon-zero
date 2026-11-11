import DisclosureText from './DisclosureText';
/**
 * An inbound dilemma's authored omen is visible before language decoding exists.
 * The decoded forecast owns the countdown; this notice never reveals locked choices.
 */
import { View } from 'react-native';
import { CONTENT } from '../content';
import { useGame } from './state';
import { palette, theme } from './theme';

export default function OmenNotice() {
  const id = useGame((game) => game.pendingDilemma?.id ?? null);
  const ended = useGame((game) => game.ending !== null);
  const dilemma = CONTENT.dilemmas.find((item) => item.id === id);
  if (!dilemma || ended) return null;
  return <View testID="omen-notice" accessibilityRole="alert" accessibilityLiveRegion="polite"
    style={{ borderLeftWidth: 3, borderColor: palette.warning, paddingHorizontal: 12, paddingVertical: 8 }}>
    <DisclosureText style={theme.muted}>{dilemma.omen}</DisclosureText>
  </View>;
}
