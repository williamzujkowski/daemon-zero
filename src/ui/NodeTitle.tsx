/** A separate leaf owns the short visual reveal; its accessible name is complete. */
import { useDecryptText } from '../app/useDecryptText';
import { Text } from './PhaseTheme';
import { theme } from './theme';

export default function NodeTitle({ id, name, status, owned }: { id: string; name: string; status: string; owned: boolean }) {
  const visual = useDecryptText(name, owned, id);
  return <Text testID={'node-' + id + '-title'} accessibilityLabel={status + name} style={theme.heading}>{status}{visual}</Text>;
}
