/**
 * A separate leaf owns the short visual reveal; its accessible name is complete. The title is a heading (#302): a
 * section of the pane, or one level below the widget or card that holds it.
 */
import { useDecryptText } from '../app/useDecryptText';
import { SECTION_LEVEL, useHeadingLevel } from './headingLevel';
import { Text } from './PhaseTheme';
import { theme } from './theme';

export default function NodeTitle({ id, name, status, owned }: { id: string; name: string; status: string; owned: boolean }) {
  const visual = useDecryptText(name, owned, id);
  const level = useHeadingLevel() ?? SECTION_LEVEL;
  return <Text testID={'node-' + id + '-title'} accessibilityRole="header" aria-level={level} accessibilityLabel={status + name}
    style={theme.heading}>{status}{visual}</Text>;
}
