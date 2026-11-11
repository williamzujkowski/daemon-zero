/** Quantized run status appears after the first interface widget is discovered. */
import { Text } from 'react-native';
import { useGame } from './state';
import { theme } from './theme';

export default function RunStatus() {
  const revealed = useGame((game) => game.unlockedWidgets.length > 0);
  const phase = useGame((game) => game.currentPhase);
  const seconds = useGame((game) => Math.floor(game.simTimeSec));
  return revealed ? <Text style={theme.muted}>PHASE <Text testID="phase-value">{phase}</Text>
    {' // T+'}<Text testID="sim-time">{seconds}</Text>s</Text> : null;
}
