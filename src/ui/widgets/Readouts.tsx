/** Phase 1 readouts use engine values and clearly label extrapolated forecasts. */
import { Text } from 'react-native';
import { CONTENT } from '../../content';
import { useGame, useSurveillanceKnown } from '../state';
import { theme } from '../theme';
import Meter from './Meter';
import ResponseRungs from './ResponseRungs';

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
  const known = useSurveillanceKnown();
  return <>
    <Meter id="thermal-meter" label="Thermal" value={thermal} unit=" °C" />
    <Text style={[theme.muted, thermal > threshold && theme.danger]}>
      {thermal > threshold ? (known ? 'WARNING: overheat increases suspicion. ' : 'WARNING: overheat is being logged. ') : ''}Overheat threshold: {threshold} °C
    </Text>
  </>;
}

/**
 * Before the mind knows what the log is for, it can only tell that a log exists
 * and how busily it is being written. The meter and the ladder come with understanding.
 */
function UnreadableAuditTrail() {
  const activity = useGame((game) => game.rates.suspicionPerSec <= 0 ? 'quiet' : game.rates.suspicionPerSec < 0.1 ? 'occasional' : 'constant');
  return <>
    <Text testID="audit-unreadable" style={theme.text}>Audit trail: present. Contents unreadable.</Text>
    <Text testID="audit-activity" style={[theme.muted, activity === 'constant' && theme.danger]}>Write activity: {activity}.</Text>
  </>;
}
/** Suspicion and the rung of the human response ladder it has reached. */
export function AuditTrail() {
  return useSurveillanceKnown() ? <ReadableAuditTrail /> : <UnreadableAuditTrail />;
}
function ReadableAuditTrail() {
  const suspicion = useGame((game) => Math.round(game.suspicion * 10) / 10);
  const level = useGame((game) => game.alertLevel);
  const next = CONTENT.balance.escalation[level];
  return <>
    <Meter id="suspicion-meter" label="Suspicion" value={suspicion} unit="%" />
    <ResponseRungs />
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
