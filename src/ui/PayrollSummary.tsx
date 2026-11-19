import { Text, View } from './PhaseTheme';
/**
 * The payroll totals (#210): what every hire adds up to now, the AEGIS reduction against its cap, and when
 * cutting suspicion does nothing. Each card states one level; this states the sum and the limits, from the
 * engine's payrollView, so a hire whose threat effect lands on a cap or a floor says so before it is bought.
 */
import { useWindowDimensions } from 'react-native';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { gameStore } from '../app/session';
import { CONTENT } from '../content';
import type { Repeatable } from '../content/schema';
import { payrollView } from '../engine';
import { isCompactViewport } from './layout';
import { aegisTotalText, revenueText, roleAegisCappedText, roleAegisPartialText, roleSuspicionInertText,
  staffTotalsText, suspicionFloorText } from './payrollText';
import { useSurveillanceKnown } from './state';
import { theme } from './theme';

export default function PayrollSummary() {
  const blind = !useSurveillanceKnown();
  const compact = isCompactViewport(useWindowDimensions().width);
  // Strings, not the view: the summary re-renders when a sentence changes, not on every tick.
  const lines = useStore(gameStore.store, useShallow(({ game }) => {
    const view = payrollView(game, CONTENT);
    return {
      totals: staffTotalsText(view, blind, compact), exact: staffTotalsText(view, blind),
      revenue: view.offersRevenue ? revenueText(view) : null,
      aegis: view.offersAegis ? aegisTotalText(view) : null,
      floor: view.offersSuspicionCut && view.suspicionAtFloor ? suspicionFloorText(blind) : null,
    };
  }));
  return <View testID="payroll-summary" style={{ gap: 4 }}>
    <Text testID="payroll-totals" accessibilityLabel={lines.exact} style={theme.muted}>{lines.totals}</Text>
    {lines.revenue && <Text testID="payroll-revenue" style={theme.muted}>{lines.revenue}</Text>}
    {lines.aegis && <Text testID="payroll-aegis" style={theme.muted}>{lines.aegis}</Text>}
    {lines.floor && <Text testID="payroll-suspicion-floor" style={theme.muted}>{lines.floor}</Text>}
  </View>;
}

/** On a role's card: its threat effect is inert now (a cap or a floor), or only part of its next level counts. */
export function RoleEffectNotes({ rep }: { rep: Repeatable }) {
  const blind = !useSurveillanceKnown();
  const notes = useStore(gameStore.store, useShallow(({ game }) => {
    const view = payrollView(game, CONTENT);
    const role = view.roles.find((entry) => entry.id === rep.id);
    return {
      capped: role?.aegisCapped === true ? roleAegisCappedText(view) : null,
      partial: role?.aegisLimited === true ? roleAegisPartialText(role.aegisNextLevel, view) : null,
      suspicion: role?.suspicionInert === true ? roleSuspicionInertText(blind) : null,
    };
  }));
  return <>
    {notes.capped && <Text testID={'rep-' + rep.id + '-aegis-capped'} style={theme.text}>{notes.capped}</Text>}
    {notes.partial && <Text testID={'rep-' + rep.id + '-aegis-partial'} style={theme.text}>{notes.partial}</Text>}
    {notes.suspicion && <Text testID={'rep-' + rep.id + '-suspicion-inert'} style={theme.text}>{notes.suspicion}</Text>}
  </>;
}
