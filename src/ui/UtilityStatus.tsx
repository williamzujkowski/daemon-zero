/** Only already-revealed critical status follows the player into utility pages. */
import { CONTENT } from '../content';
import { selectNotice, useGameValue } from '../app/selectors';
import { useGame, useSurveillanceKnown } from './state';
import { aegisCritical, resourceWidgets, thermalWidget, threatWidget } from './registry/widgetRegistry';
import { Text, View } from './PhaseTheme';
import OmenNotice from './OmenNotice';
import { insolvencyRemedy, overheatRemedy, shortfallText } from './remedyText';
import { isActuatorAvailable } from '../engine';
import { theme } from './theme';

export default function UtilityStatus() {
  const notice = useGameValue(selectNotice);
  const known = useSurveillanceKnown();
  const cycleDeficit = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.cycles) && (game.brownout || game.rates.cyclesPerSec < 0));
  const insolvency = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.capital) && game.insolvent);
  const shortfall = useGame((game) => game.unlockedWidgets.includes(resourceWidgets.capital) && game.rates.megawattsGenerated < game.rates.megawattsConsumed);
  const thermal = useGame((game) => game.unlockedWidgets.includes(thermalWidget) && game.thermal > CONTENT.balance.thermalThresholdForSuspicion);
  const fanAvailable = useGame((game) => isActuatorAvailable(game, 'fanSpeedRatio', CONTENT));
  const fanFull = useGame((game) => game.actuators.fanSpeedRatio >= 1);
  const generated = useGame((game) => game.rates.megawattsGenerated);
  const consumed = useGame((game) => game.rates.megawattsConsumed);
  const allocation = useGame((game) => isActuatorAvailable(game, 'computeProfitAllocationRatio', CONTENT));
  const response = useGame((game) => game.alertLevel);
  const lock = useGame((game) => game.unlockedWidgets.includes(threatWidget) && aegisCritical(game.aegisLock));
  return <View testID="menu-status" style={{ gap: 8 }}>
    {notice !== null && <Text accessibilityRole="alert" style={[theme.text, theme.danger]}>{notice}</Text>}
    {cycleDeficit && <Warning text="CYCLE DEFICIT: check running processes or add compute." />}
    {insolvency && <Warning text={'INSOLVENT: capital exhausted. ' + insolvencyRemedy(allocation)} />}
    {shortfall && <Warning text={shortfallText(generated, consumed)} />}
    {/* "check cooling" named no remedy that worked once the fan was already full (#369). */}
    {thermal && <Warning text={'OVERHEAT: ' + overheatRemedy({ available: fanAvailable, full: fanFull })} />}
    {known && response > 0 && <Warning text={'Response: ' + (CONTENT.narrative.alertLevels[response]?.label ?? 'Elevated')} />}
    {lock && <Warning text="AEGIS LOCK CRITICAL: return to the game." />}
    <OmenNotice id="menu-omen-notice" />
  </View>;
}

function Warning({ text }: { text: string }) {
  return <Text accessibilityRole="alert" style={[theme.text, theme.danger]}>{text}</Text>;
}
