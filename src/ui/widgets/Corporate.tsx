import { Pressable, Text, View } from '../PhaseTheme';
/** Corporate finance and power stay explicit while purchases remain registry-driven. */

import { CONTENT } from '../../content';
import { setActuator } from '../../engine';
import { gameRuntime } from '../../app/session';
import ActionsPanel from '../ActionsPanel';
import NodeList from '../NodeList';
import Repeatables from '../Repeatables';
import { useGame, useSurveillanceKnown } from '../state';
import { theme } from '../theme';

function Ledger() {
  const known = useSurveillanceKnown();
  const capital = useGame((game) => Math.floor(game.capital));
  const income = useGame((game) => game.rates.capitalPerSec);
  const generated = useGame((game) => game.rates.megawattsGenerated);
  const consumed = useGame((game) => game.rates.megawattsConsumed);
  const efficiency = useGame((game) => Math.round(game.rates.gridEfficiency * 100));
  const insolvent = useGame((game) => game.insolvent);
  const brownout = useGame((game) => game.brownout);
  return <View style={{ gap: 8 }}>
    <Text testID="corp-capital" style={theme.text}>Capital: ${capital} ({income >= 0 ? '+' : ''}{income.toFixed(2)}/s net)</Text>
    <Text testID="power-ledger" style={theme.text}>Power: {generated} MW generated / {consumed} MW consumed</Text>
    <Text style={theme.muted}>Grid efficiency: {efficiency}%</Text>
    {insolvent && <Text testID="insolvency-warning" accessibilityRole="alert" style={[theme.text, theme.danger]}>
      INSOLVENT: capital exhausted; {known ? 'unpaid drains increase suspicion.' : 'unpaid drains are being logged.'}</Text>}
    {generated < consumed && <Text testID="power-warning" accessibilityRole="alert" style={[theme.text, theme.danger]}>
      POWER SHORTFALL: powered hardware is throttled.</Text>}
    {brownout && <Text testID="brownout-warning" accessibilityRole="alert" style={[theme.text, theme.danger]}>
      BROWNOUT: cycle deficit; understanding generation is halted.</Text>}
  </View>;
}

function Allocation() {
  const ratio = useGame((game) => game.actuators.computeProfitAllocationRatio);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  return <View style={{ gap: 8 }}>
    <Text testID="allocation-value" style={theme.text}>Compute diverted to revenue: {Math.round(ratio * 100)}%</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[0, 0.25, 0.5, 0.75, 1].map((step) => {
      const value = step * CONTENT.balance.maxProfitAllocation, percent = Math.round(value * 100);
      return <Pressable key={percent} testID={'allocation-' + String(percent)} accessibilityRole="button"
        accessibilityLabel={'Allocate ' + String(percent) + ' percent to revenue'} aria-pressed={Math.abs(value - ratio) < 1e-6}
        accessibilityState={{ selected: Math.abs(value - ratio) < 1e-6 }} disabled={blocked}
        style={[theme.button, { paddingHorizontal: 8 }, blocked && theme.disabled]}
        onPress={() => { gameRuntime.dispatch((game) => setActuator(game, 'computeProfitAllocationRatio', value, CONTENT)); }}>
        <Text style={theme.text}>{percent}%</Text></Pressable>;
    })}</View>
  </View>;
}

export default function Corporate() {
  const current = useGame((game) => game.currentPhase);
  const phases = CONTENT.phases.filter((phase) => phase.uiSlot === 'CORP' && phase.phaseId <= current).slice().reverse();
  return <View style={{ gap: 14 }}>
    <Ledger /><Allocation />
    {phases.map((phase) => <View key={phase.phaseId} style={{ gap: 14 }}>
      <NodeList phase={phase.phaseId} />
      <Repeatables phase={phase.phaseId} kind="UPGRADE" title="Infrastructure" />
      <Repeatables phase={phase.phaseId} kind="OPERATIVE" title="Operatives // payroll" />
    </View>)}
    <ActionsPanel group="CORP" />
  </View>;
}
