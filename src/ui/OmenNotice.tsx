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

/** `compact` sets the label inline ("OMEN // ...") so the desktop chrome's reserved slot holds a typical omen in two
 *  lines (#362); elsewhere the label sits on its own line. */
export default function OmenNotice({ id: noticeId = 'omen-notice', compact = false }: { id?: string; compact?: boolean } = {}) {
  const id = useGame((game) => game.pendingDilemma?.id ?? null);
  const ended = useGame((game) => game.ending !== null);
  const dilemma = CONTENT.dilemmas.find((item) => item.id === id);
  // The omen reads world history only, which cannot change while it is pending.
  const omen = useGame((game) => dilemma ? dilemmaOmen(game, dilemma, CONTENT) : '');
  if (!dilemma || ended) return null;
  // Its arrival is spoken once by the chrome's announcer, which exists on every tab; on the phone this notice lives
  // under EXECUTE in CORE and is absent off CORE (#362), so it is not a live region itself (#399 panel, #393).
  // It leads the view, so it reads at body size with a label word rather than as a grey footnote (#378); the word
  // carries the warning, not the colour alone.
  return <View testID={noticeId}
    style={{ borderLeftWidth: 3, borderColor: palette.warning, paddingHorizontal: 12, paddingVertical: 8, gap: 2 }}>
    {compact
      ? <Text style={theme.text}><Text style={{ color: palette.warning }}>{'OMEN // '}</Text><DisclosureText style={theme.text}>{omen}</DisclosureText></Text>
      : <><Text style={[theme.text, { color: palette.warning }]}>OMEN</Text><DisclosureText style={theme.text}>{omen}</DisclosureText></>}
  </View>;
}
