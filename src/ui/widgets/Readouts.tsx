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
  const threshold = CONTENT.balance.thermalThresholdForSuspicion;
  return <>
    <Meter id="thermal-meter" label="Thermal" value={thermal} unit=" °C" />
    <Text style={[theme.muted, thermal > threshold && theme.danger]}>
      {thermal > threshold ? 'WARNING: overheat increases suspicion. ' : ''}Overheat threshold: {threshold} °C
    </Text>
  </>;
}

/** Suspicion and the rung of the human response ladder it has reached. */
export function AuditTrail() {
  const suspicion = useGame((game) => Math.round(game.suspicion * 10) / 10);
  const level = useGame((game) => game.alertLevel);
  const next = CONTENT.balance.escalation[level];
  return <>
    <Meter id="suspicion-meter" label="Suspicion" value={suspicion} unit="%" />
    <Text testID="alert-level" style={[theme.text, level > 0 && theme.danger]}>
      Response: {CONTENT.narrative.alertLevels[level]?.label ?? 'UNKNOWN'}
    </Text>
    <Text style={theme.muted}>{next ? 'Next escalation at ' + String(next.at) + '%.' : 'No further escalation before reimage at 100%.'}</Text>
  </>;
}
export function Forecast() {
  const inbound = useGame((game) => game.pendingDilemma === null ? null
    : Math.max(0, Math.ceil(game.pendingDilemma.firesAtSimSec - game.simTimeSec)));
  const seconds = useGame((game) => game.rates.suspicionPerSec > 0
    ? Math.ceil((100 - game.suspicion) / game.rates.suspicionPerSec) : null);
  return <Text testID="inspection-forecast" style={theme.text}>
    {seconds === null ? 'Suspicion stable or falling.' : 'At current rate: ' + String(seconds) + 's until suspicion 100.'}
    {'\n'}{inbound === null ? 'No interrupt inbound.' : 'Interrupt inbound in ' + String(inbound) + 's. Set resources aside.'}
  </Text>;
}
