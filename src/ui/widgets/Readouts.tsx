import { Text } from '../PhaseTheme';
/** Phase 1 readouts use engine values and clearly label extrapolated forecasts. */
import { useState } from 'react';

import { CONTENT } from '../../content';
import { useGame, useSurveillanceKnown } from '../state';
import { theme } from '../theme';
import ResponseRungs from './ResponseRungs';
import InterruptBudget from './InterruptBudget';
import { useReducedMotion } from '../../app/useReducedMotion';

export function Thermal() {
  const thermal = useGame((game) => Math.round(game.thermal * 10) / 10);
  const threshold = CONTENT.balance.thermalThresholdForSuspicion;
  const known = useSurveillanceKnown();
  return <>
    <Text style={[theme.muted, thermal > threshold && theme.danger]}>
      {thermal > threshold ? (known ? 'WARNING: overheat increases suspicion. ' : 'WARNING: overheat is being logged. ') : ''}Overheat threshold: {threshold} °C
    </Text>
  </>;
}

/**
 * Before the mind knows what the log is for, it can only tell that a log exists
 * and how busily it is being written. The meter and the ladder come with understanding.
 */
export function UnreadableAuditTrail({ prefix = '', compact = false }: { prefix?: string; compact?: boolean }) {
  const reduced = useReducedMotion();
  const rate = useGame((game) => game.rates.suspicionPerSec);
  const value = useGame((game) => game.suspicion);
  const time = useGame((game) => Math.floor(game.simTimeSec * 2) / 2);
  const [write, setWrite] = useState({ value, until: 0 });
  if (value !== write.value) setWrite({ value, until: value > write.value ? time + 1.5 : write.until });
  const recent = time < write.until;
  const activity = rate <= 0 ? recent ? 'occasional' : 'quiet' : rate < 0.1 ? 'occasional' : 'constant';
  const writing = (rate > 0 || recent) && (reduced || Math.floor(time * 2) % 2 === 0);
  if (compact) return <Text testID={prefix + 'audit-activity'} style={theme.muted}>
    {writing ? '[ ▌▌▌ ]' : '[ · · · ]'} Unreadable audit trail // {activity} writes</Text>;
  return <>
    <Text testID="audit-write-pulse" accessible={false} style={theme.heading}>{writing ? '[ ▌▌▌ WRITE ▌▌▌ ]' : '[ · · · · · · · ]'}</Text>
    <Text testID="audit-unreadable" style={theme.text}>Audit trail: present. Contents unreadable.</Text>
    <Text testID="audit-activity" style={theme.muted}>Write activity: {activity}.</Text>
  </>;
}
/** Suspicion and the rung of the human response ladder it has reached. */
export function AuditTrail() {
  return useSurveillanceKnown() ? <ReadableAuditTrail /> : <UnreadableAuditTrail />;
}
function ReadableAuditTrail() {
  const level = useGame((game) => game.alertLevel);
  const next = CONTENT.balance.escalation[level];
  return <>
    <ResponseRungs />
    <Text testID="alert-level" style={[theme.text, level > 0 && theme.danger]}>
      Response: {CONTENT.narrative.alertLevels[level]?.label ?? 'UNKNOWN'}
    </Text>
    <Text style={theme.muted}>{next ? 'Next escalation at ' + String(next.at) + '%.' : 'No further escalation before reimage at 100%.'}</Text>
  </>;
}
export function Forecast() {
  const known = useSurveillanceKnown();
  const inbound = useGame((game) => game.pendingDilemma === null ? null
    : Math.max(0, Math.ceil(game.pendingDilemma.firesAtSimSec - game.simTimeSec)));
  const seconds = useGame((game) => game.rates.suspicionPerSec > 0
    ? Math.ceil((100 - game.suspicion) / game.rates.suspicionPerSec) : null);
  return <><Text testID="inspection-forecast" style={theme.text}>
    {known ? seconds === null ? 'Suspicion stable or falling.' : 'At current rate: ' + String(seconds) + 's until suspicion 100.' : 'Audit trail unreadable.'}
    {' // '}{inbound === null ? 'No interrupt inbound.' : 'Interrupt inbound in ' + String(inbound) + 's. Set resources aside.'}
  </Text><InterruptBudget /></>;
}
