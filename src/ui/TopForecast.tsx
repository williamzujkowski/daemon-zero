/** Unlocked interrupt timing and paid-response reserves stay above every workspace. */
import { Text, View } from './PhaseTheme';
import { CONTENT } from '../content';
import { forecastWidget } from './registry/widgetRegistry';
import { useGame } from './state';
import { theme } from './theme';
import { Forecast } from './widgets/Readouts';

export default function TopForecast() {
  const unlocked = useGame((game) => game.unlockedWidgets.includes(forecastWidget));
  if (!unlocked) return null;
  return <View testID="forecast-notice" style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 4 }}>
    <Text accessibilityRole="header" style={theme.heading}>{CONTENT.widgets.get(forecastWidget)?.title}</Text>
    <Forecast />
  </View>;
}
