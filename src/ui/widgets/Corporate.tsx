import { Pressable, Text, View } from '../PhaseTheme';
/** Corporate finance and power stay explicit while purchases remain registry-driven. */

import { CONTENT } from '../../content';
import { compactAmount, cycleContributions, financeEnabled, groupDigits, isActuatorAvailable, scaleScrutiny, setActuator } from '../../engine';
import { gameRuntime } from '../../app/session';
import ActionsPanel from '../ActionsPanel';
import { compactNumber } from '../compactNumber';
import { profitAllocationValues } from '../actuatorSteps';
import NodeList from '../NodeList';
import PayrollSummary from '../PayrollSummary';
import Repeatables from '../Repeatables';
import { insolvencyRemedy, shortfallText } from '../remedyText';
import { useGame, useSurveillanceKnown } from '../state';
import { theme } from '../theme';
import UpgradeFeed from '../UpgradeFeed';
import type { WorkspaceArea } from '../workspaceTypes';

function Ledger() {
  const capital = useGame((game) => Math.floor(game.capital));
  const income = useGame((game) => game.rates.capitalPerSec);
  const generated = useGame((game) => game.rates.megawattsGenerated);
  const consumed = useGame((game) => game.rates.megawattsConsumed);
  const efficiency = useGame((game) => Math.round(game.rates.gridEfficiency * 100));
  return <View style={{ gap: 8 }}>
    {/* "$5010896882 (+26203469.12/s net)" was a wall of digits (#404): capital and rates in K/M/B, like the strip. */}
    <Text testID="corp-capital" style={theme.text}>Capital: ${compactAmount(capital)} ({income >= 0 ? '+' : ''}{compactNumber(income, 2)}/s net)</Text>
    <Text testID="power-ledger" style={theme.text}>Power: {groupDigits(Math.round(generated))} MW generated / {groupDigits(Math.round(consumed))} MW consumed</Text>
    <Text style={theme.muted}>Grid efficiency: {efficiency}%</Text>
    <Scrutiny />
    <ComputeSplit />
  </View>;
}

/**
 * Scale scrutiny (#210), stated beside the income it is read from: the suspicion the tick adds now, the
 * phase's rate per $1M/s and its ceiling. Absent where the phase declares none or the scale is provisioned.
 */
function Scrutiny() {
  const known = useSurveillanceKnown();
  const reading = useGame((game) => {
    const found = scaleScrutiny(game, game.rates, CONTENT);
    return found === null ? null
      : [compactNumber(found.incomePerSec, 0), found.perSec.toFixed(2), String(found.perSecAtMillionUsd), growth(found.incomeExponent), String(found.maxPerSec), found.incomePerSec > 0 ? 'y' : ''].join('|');
  });
  if (reading === null) return null;
  const [income = '', perSec = '', atMillion = '', grows = '', ceiling = '', earning = ''] = reading.split('|');
  const rule = `(+${atMillion}/s at $1M/s, growing ${grows}; at most ${ceiling}/s)`;
  // A loss is not income: say so rather than "$0/s net income draws +0.00" (emulator re-check, #323).
  const draw = earning ? `Scrutiny: $${income}/s net income draws +${perSec} suspicion/s ${rule}.` : `Scrutiny: no net income, so no draw ${rule}.`;
  return <Text testID="corp-scrutiny" style={theme.muted}>
    {known ? draw : `Scrutiny: $${income}/s net income is being logged.`}
  </Text>;
}

/** How the draw grows with income: in words for the two shapes a ledger reader knows, otherwise as a power. */
function growth(exponent: number): string {
  if (exponent === 1) return 'in proportion to income';
  if (exponent === 0.5) return 'with the square root of income';
  return `with income to the power ${String(exponent)}`;
}

/**
 * Who controls the compute (DZ-10.2): owned output against output that runs on a grant and stops with it.
 * Shown only when something is granted, so production's ledger, where everything is owned, is unchanged.
 */
function ComputeSplit() {
  const split = useGame((game) => {
    const sources = cycleContributions(game, CONTENT);
    const sum = (basis: string) => sources.filter((source) => source.basis === basis).reduce((total, source) => total + source.cyclesPerSec, 0);
    return `${sum('OWNED').toFixed(1)}|${sum('GRANTED').toFixed(1)}|${String(game.unlockedNodes.some((id) => CONTENT.nodes.get(id)?.grant !== undefined))}`;
  });
  const [owned, granted, grants] = split.split('|');
  if (grants !== 'true') return null;
  return <Text testID="corp-compute-split" style={theme.muted}>
    Compute: {owned} cycles/s owned, {granted} cycles/s granted. Granted output and income stop with the grant; what is owned keeps running.
  </Text>;
}

/**
 * Run-threatening alerts, rendered in the terminal chrome (#125).
 *
 * They used to render inside the CORP workspace block, so they appeared only while
 * CORP was the slot in view: measured on main, switching to CORE, SENSORS or
 * NETWORK removed the insolvency sentence from the document entirely, and the
 * player read the purchase feed while the run ended without being told why. At
 * 320x568 it also sat at 548px against a 523px usable edge, so it started life
 * behind the tab bar and needed a scroll to read.
 *
 * In the chrome they are on screen in every slot and at every scroll position, at
 * no vertical cost: the alert block already occupied chrome height where it was.
 */
export function CorporateAlerts() {
  const known = useSurveillanceKnown();
  const insolvent = useGame((game) => game.insolvent);
  const brownout = useGame((game) => game.brownout);
  const shortfall = useGame((game) => game.rates.megawattsGenerated < game.rates.megawattsConsumed);
  const remedy = useGame((game) => insolvencyRemedy(game));
  const generated = useGame((game) => game.rates.megawattsGenerated);
  const consumed = useGame((game) => game.rates.megawattsConsumed);
  return <View>
    {insolvent && <Text testID="insolvency-warning" accessibilityRole="alert" style={[theme.text, theme.danger]}>
      INSOLVENT: capital exhausted; {known ? 'unpaid drains increase suspicion.' : 'unpaid drains are being logged.'} {remedy}</Text>}
    {shortfall && <Text testID="power-warning" accessibilityRole="alert" style={[theme.text, theme.danger]}>
      {shortfallText(generated, consumed)}</Text>}
    {brownout && <Text testID="brownout-warning" accessibilityRole="alert" style={[theme.text, theme.danger]}>
      BROWNOUT: cycle deficit; understanding generation is halted.</Text>}
  </View>;
}

function Allocation() {
  const ratio = useGame((game) => game.actuators.computeProfitAllocationRatio);
  const blocked = useGame((game) => game.activeDilemmaId !== null || game.ending !== null);
  // Asked of the engine, which refuses the same dial on the same rule: no dead buttons.
  const available = useGame((game) => isActuatorAvailable(game, 'computeProfitAllocationRatio', CONTENT));
  // A ledger can arrive before any company exists (the lawful route's service contract, DZ-10): the dial
  // would divert nothing, so it is not offered until a corporate entity is active.
  const entity = useGame((game) => financeEnabled(game, CONTENT));
  if (!available) return null;
  if (!entity) return <Text testID="allocation-unavailable" style={theme.muted}>Revenue allocation needs an active corporate entity.</Text>;
  return <View style={{ gap: 8 }}>
    <Text testID="allocation-value" style={theme.text}>Compute diverted to revenue: {Math.round(ratio * 100)}%</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{profitAllocationValues(CONTENT).map((value) => {
      const percent = Math.round(value * 100);
      return <Pressable key={percent} testID={'allocation-' + String(percent)} accessibilityRole="button"
        accessibilityLabel={'Allocate ' + String(percent) + ' percent to revenue'} aria-pressed={Math.abs(value - ratio) < 1e-6}
        accessibilityState={{ selected: Math.abs(value - ratio) < 1e-6 }} disabled={blocked}
        style={[theme.button, { paddingHorizontal: 8 }, blocked && theme.disabled]}
        onPress={() => { gameRuntime.dispatch((game) => setActuator(game, 'computeProfitAllocationRatio', value, CONTENT)); }}>
        <Text style={theme.text}>{percent}%</Text></Pressable>;
    })}</View>
  </View>;
}

export default function Corporate({ area = 'work' }: { area?: WorkspaceArea }) {
  const current = useGame((game) => game.currentPhase);
  const phases = CONTENT.phases.filter((phase) => phase.uiSlot === 'CORP' && phase.phaseId <= current).slice().reverse();
  // The totals cover every role, so they sit once, under the newest phase that authors payroll roles.
  const payrollPhase = phases.find((phase) => [...CONTENT.repeatables.values()]
    .some((rep) => rep.kind === 'OPERATIVE' && rep.phaseId === phase.phaseId))?.phaseId;
  // Before any corporate phase (a service's billing ledger, DZ-10) the work area shows the ledger, not nothing.
  if (area === 'work' && phases.length === 0) return <Ledger />;
  if (area === 'finance') return <View style={{ gap: 14 }}><Ledger /><Allocation /><ActionsPanel group="CORP" /></View>;
  return <View style={{ gap: 14 }}>
    {phases.map((phase) => <View key={phase.phaseId} style={{ gap: 14 }}>
      {area === 'payroll' ? <Repeatables phase={phase.phaseId} kind="OPERATIVE" title="Operatives // payroll"
        summary={phase.phaseId === payrollPhase ? <PayrollSummary /> : undefined} />
        : <><NodeList phase={phase.phaseId} /><UpgradeFeed phase={phase.phaseId} title="Infrastructure" /></>}
    </View>)}
  </View>;
}
