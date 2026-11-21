import { Text } from './PhaseTheme';
/**
 * Defers classified authored passages until their metric is understood.
 * The source text is never rewritten; decoding restores it verbatim.
 */
import { type TextProps } from 'react-native';
import { useSurveillanceKnown } from './state';

/** The text a classified passage shows: unreadable until the mind understands the metric it names. */
export function disclosed(text: string, known: boolean): string {
  return !known && /\bsuspicion\b/i.test(text) ? 'Audit entry unreadable.' : text;
}

export default function DisclosureText({ children, ...props }: TextProps & { children: string }) {
  const known = useSurveillanceKnown();
  const text = disclosed(children, known);
  return <Text {...props} accessibilityLabel={text}>{text}</Text>;
}
