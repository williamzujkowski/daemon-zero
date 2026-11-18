/**
 * The phone tier shows one pane at a time, so a support channel ticket arriving on CORE while another
 * pane is open went unseen (#284). This names it in the chrome, non-modally, with a way to open CORE;
 * the tab bar marks CORE too. Wider tiers always show CORE and never render it.
 */
import { CONTENT } from '../content';
import { channelContactView, type GameState } from '../engine';
import { Pressable, Text, View } from './PhaseTheme';
import { useGame } from './state';
import { palette, theme } from './theme';

/** The waiting ticket's title, or null when no channel contact is waiting for an answer. */
export const waitingContact = (game: GameState): string | null => channelContactView(game, CONTENT)?.pending?.title ?? null;

export default function ContactNotice({ open }: { open: () => void }) {
  const title = useGame(waitingContact);
  if (title === null) return null;
  return <View testID="contact-notice" accessibilityLiveRegion="polite"
    style={{ borderLeftWidth: 3, borderColor: palette.warning, paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}>
    <Text style={theme.muted}>SUPPORT_CHANNEL: a ticket about the {title} is waiting for an answer on CORE.</Text>
    <Pressable testID="contact-notice-open" accessibilityRole="button" accessibilityLabel="Open core: answer the support channel ticket"
      style={[theme.button, { alignSelf: 'flex-start' }]} onPress={open}><Text style={theme.text}>[ OPEN CORE ]</Text></Pressable>
  </View>;
}
