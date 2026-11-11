import { Text } from './PhaseTheme';
/**
 * Defers classified authored passages until their metric is understood.
 * The source text is never rewritten; decoding restores it verbatim.
 */
import { type TextProps } from 'react-native';
import { useSurveillanceKnown } from './state';

export default function DisclosureText({ children, ...props }: TextProps & { children: string }) {
  const known = useSurveillanceKnown();
  return <Text {...props}>{!known && /\bsuspicion\b/i.test(children) ? 'Audit entry unreadable.' : children}</Text>;
}
