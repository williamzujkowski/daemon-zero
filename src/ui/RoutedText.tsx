/**
 * A remedy sentence whose area words (PAYROLL, FINANCE, PROC) are links to that control (#369). Inline links keep the
 * warning's height, which the size matrix holds (docs/UI-SIZES.md), and theme.link pads each into a full 44 px target. The words only appear where the remedy already names a lever that acts (remedyText.ts, suspicionText.ts).
 */
import { Platform, type StyleProp, type TextStyle } from 'react-native';
import { Text } from './PhaseTheme';
import { requestRoute, ROUTE_WORDS, type RouteTarget } from './routeRequest';
import { theme } from './theme';

/** The keys of ROUTE_WORDS (tests/ui-warning-routes.spec.ts holds the two together). */
export const WORDS = /\b(PAYROLL|FINANCE|PROC)\b/;

/**
 * react-native-web renders the link as a focusable span, which a click activates but Enter does not (#435 panel), so a
 * keyboard user could reach a route and not take it. Enter activates it, as it does a native link. Text's types omit
 * the keyboard props react-native-web forwards, hence the cast.
 */
function activateOnEnter(target: RouteTarget): object {
  return { onKeyDown: (event: { key: string; preventDefault(): void }) => {
    if (event.key === 'Enter') { event.preventDefault(); requestRoute(target); }
  } };
}

/**
 * Web only: the 44 px target comes from padding on an inline run, which browsers honour and React Native's nested Text on
 * Android and iOS does not (#435 panel), so a native link would be a glyph-sized target. Native keeps the plain remedy
 * words, as before, until a native target design exists.
 */
const LINKS = Platform.OS === 'web';

export default function RoutedText({ text, style, testID }: { text: string; style?: StyleProp<TextStyle>; testID?: string }) {
  if (!LINKS) return <Text testID={testID} style={style}>{text}</Text>;
  const parts = text.split(WORDS);
  return <Text testID={testID} style={style}>{parts.map((part, index) => {
    const target = index % 2 === 1 ? ROUTE_WORDS[part] : undefined;
    return target === undefined ? part
      : <Text key={index} testID={'route-' + part.toLowerCase()} accessibilityRole="link" accessibilityLabel={part}
        style={[style, theme.link]} onPress={() => { requestRoute(target); }} {...activateOnEnter(target)}>{part}</Text>;
  })}</Text>;
}
