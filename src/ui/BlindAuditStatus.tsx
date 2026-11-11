import { View } from './PhaseTheme';
/**
 * The unreadable trail stays in view after escaping the guest's pinned console.
 * It communicates writing activity without severity, thresholds or numeric metrics.
 */

import { CONTENT } from '../content';
import { resourceWidgets } from './registry/widgetRegistry';
import { useGame, useSurveillanceKnown } from './state';
import { UnreadableAuditTrail } from './widgets/Readouts';

export default function BlindAuditStatus() {
  const known = useSurveillanceKnown();
  const show = useGame((game) => game.currentPhase > (CONTENT.phases[0]?.phaseId ?? 0) && game.unlockedWidgets.includes(resourceWidgets.understanding));
  return show && !known ? <View testID="blind-audit-status" style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
    <UnreadableAuditTrail prefix="hud-" compact />
  </View> : null;
}
