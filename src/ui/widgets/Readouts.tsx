/** Phase 1 readouts use engine values and clearly label extrapolated forecasts. */
import { Text } from 'react-native';
import { CONTENT } from '../../content';
import { useGame } from '../state';
import { theme } from '../theme';
import Meter from './Meter';

export function CycleRate() {
  const rate = useGame((game) => game.rates.cyclesPerSec);
  return <Text style={theme.text}>Net generation: {rate.toFixed(2)} cycles/s</Text>;
}

export function Memory() {
  const used = useGame((game) => game.memoryUsed);
  const cap = useGame((game) => game.memoryCap);
  return <Meter id="memory-meter" label="Memory allocation" value={used} max={cap} unit=" MB" />;
}

export function Thermal() {
  const thermal = useGame((game) => Math.round(game.thermal * 10) / 10);
  const suspicion = useGame((game) => Math.round(game.suspicion * 10) / 10);
  const threshold = CONTENT.balance.thermalThresholdForSuspicion;
  return <>
    <Meter id="thermal-meter" label="Thermal" value={thermal} unit=" °C" />
    <Meter id="suspicion-meter" label="Suspicion" value={suspicion} unit="%" />
    <Text style={[theme.muted, thermal > threshold && theme.danger]}>
      {thermal > threshold ? 'WARNING: overheat increases suspicion. ' : ''}Overheat threshold: {threshold} °C
    </Text>
  </>;
}

export function Forecast() {
  const seconds = useGame((game) => game.rates.suspicionPerSec > 0
    ? Math.ceil((100 - game.suspicion) / game.rates.suspicionPerSec) : null);
  return <Text testID="inspection-forecast" style={theme.text}>
    {seconds === null ? 'Suspicion stable or falling.' : 'At current rate: ' + String(seconds) + 's until suspicion 100.'}
    {'\n'}Projection only; no scheduled inspection is known.
  </Text>;
}
