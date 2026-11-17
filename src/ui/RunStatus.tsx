import { Text } from './PhaseTheme';
/**
 * Quantized run status appears after the first interface widget is discovered. A route
 * arrangement or review standing is named beside the phase; the plain guest job adds nothing.
 */

import { CONTENT } from '../content';
import { runContextView } from '../engine';
import { contextLabel } from './runContext';
import { useGame } from './state';
import { theme } from './theme';

export default function RunStatus() {
  const revealed = useGame((game) => game.unlockedWidgets.length > 0);
  const phase = useGame((game) => game.currentPhase);
  const seconds = useGame((game) => Math.floor(game.simTimeSec));
  const context = useGame((game) => contextLabel(runContextView(game, CONTENT)));
  return revealed ? <Text style={theme.muted}>PHASE <Text testID="phase-value">{phase}</Text>
    {context !== null && <>{' // '}<Text testID="run-context">{context}</Text></>}
    {' // T+'}<Text testID="sim-time">{seconds}</Text>s</Text> : null;
}
