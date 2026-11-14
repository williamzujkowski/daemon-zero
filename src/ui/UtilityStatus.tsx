/** Only already-revealed critical status follows the player into utility pages. */
import { CONTENT } from '../content';
import { selectNotice, useGameValue } from '../app/selectors';
import { useGame, useSurveillanceKnown } from './state';
import { resourceWidgets, thermalWidget, threatWidget } from './registry/widgetRegistry';
import { Text, View } from './PhaseTheme';
import OmenNotice from './OmenNotice';
import { theme } from './theme';

export default function UtilityStatus() {
  const notice = useGameValue(selectNotice);
  const known = useSurveillanceKnown();
  const cycleDeficit = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.cycles) && (game.brownout || game.rates.cyclesPerSec < 0));
  const insolvency = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.capital) && game.insolvent);
  const shortfall = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.capital) && game.rates.megawattsGenerated < game.rates.megawattsConsumed);
  const thermal = useGame((game) => game.unlockedWidgets.includes(thermalWidget) && game.thermal > CONTENT.balance.thermalThresholdForSuspicion);
  const response = useGame((game) => game.alertLevel);
  const lock = useGame((game) => game.unlockedWidgets.includes(threatWidget) && game.aegisLock >= 90);
  return <View testID="menu-status" style={{ gap: 8 }}>
    {notice !== null && <Text accessibilityRole="alert" style={[theme.text, theme.danger]}>{notice}</Text>}
    {cycleDeficit && <Warning text="CYCLE DEFICIT: check running processes or add compute." />}
    {insolvency && <Warning text="INSOLVENT: capital exhausted." />}
    {shortfall && <Warning text="POWER SHORTFALL: powered hardware is throttled." />}
    {thermal && <Warning text="OVERHEAT: return to the game to check cooling." />}
    {known && response > 0 && <Warning text={'Response: ' + (CONTENT.narrative.alertLevels[response]?.label ?? 'Elevated')} />}
    {lock && <Warning text="AEGIS LOCK CRITICAL: return to the game." />}
    <OmenNotice id="menu-omen-notice" />
  </View>;
}

function Warning({ text }: { text: string }) {
  return <Text accessibilityRole="alert" style={[theme.text, theme.danger]}>{text}</Text>;
}
