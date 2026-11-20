import { Text, View } from './PhaseTheme';
import DisclosureText from './DisclosureText';
/**
 * An inbound dilemma's authored omen is visible before language decoding exists.
 * The decoded forecast owns the countdown; this notice never reveals locked choices.
 */

import { CONTENT } from '../content';
import { dilemmaOmen } from '../engine';
import { useGame } from './state';
import { palette, theme } from './theme';

export default function OmenNotice({ id: noticeId = 'omen-notice' }: { id?: string } = {}) {
  const id = useGame((game) => game.pendingDilemma?.id ?? null);
  const ended = useGame((game) => game.ending !== null);
  const dilemma = CONTENT.dilemmas.find((item) => item.id === id);
  // The omen reads world history only, which cannot change while it is pending.
  const omen = useGame((game) => dilemma ? dilemmaOmen(game, dilemma, CONTENT) : '');
  if (!dilemma || ended) return null;
  // A heads-up, not an emergency: a polite status, whose role now matches its politeness (it was role=alert with
  // aria-live=polite, #363). It leads the view, so it reads at body size with a label word rather than as a grey
  // footnote weaker than every button (#378); the word carries the warning, not the colour alone.
  return <View testID={noticeId} role="status" accessibilityLiveRegion="polite"
    style={{ borderLeftWidth: 3, borderColor: palette.warning, paddingHorizontal: 12, paddingVertical: 8, gap: 2 }}>
    <Text style={[theme.text, { color: palette.warning }]}>OMEN</Text>
    <DisclosureText style={theme.text}>{omen}</DisclosureText>
  </View>;
}
