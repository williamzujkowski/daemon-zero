/**
 * Names a preview build where the player starts and in the menu (#205). The channel comes from
 * the content the bundle was built with, so a production build renders nothing here.
 */
import { CONTENT } from '../content';
import { Text } from './PhaseTheme';
import { palette, theme } from './theme';

export default function PreviewMarker({ id }: { id: string }) {
  if (CONTENT.channel !== 'preview') return null;
  return <Text testID={id} style={[theme.text, { color: palette.warning }]}>
    PREVIEW BUILD · unfinished content · saves stay in this build
  </Text>;
}
