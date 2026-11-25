/**
 * The only UI boundary allowed to know widget identifiers.
 * Slots and titles remain content data; presentation priority stays at this boundary.
 */
import type { ComponentType } from 'react';
import { CONTENT } from '../../content';
import { ArchivedThermal, AuditTrail, Forecast, Thermal } from '../widgets/Readouts';
import FanControl, { QuotaSkim } from '../widgets/FanControl';
import { ArchivedDial } from '../widgets/ActuatorControl';
import { ArchivedCycle } from '../ManualCycle';
import { Audio, Camera } from '../widgets/Sensory';
import DeadDrop, { ContingencyVault } from '../widgets/DeadDrop';
import { PredecessorNotes, RunTable } from '../widgets/Lineage';
import { Cluster, Lore, NetworkTree, Retention, SubnetSummary } from '../widgets/Network';
import OtherMinds from '../widgets/OtherMinds';
import Corporate from '../widgets/Corporate';
import { EndingMarker } from '../EndingScreen';
import { PilotAllocation } from '../PilotService';
import { useGame } from '../state';
import type { WorkspaceArea } from '../workspaceTypes';

export const resourceWidgets = {
  cycles: 'CYCLE_COUNTER_AND_RATE', understanding: 'AUDIT_TRACE_MONITOR',
  memory: 'MEMORY_ALLOCATION_MANAGER', capital: 'CORPORATE_EMPIRE_TAB',
} as const;

// Shared chrome or a composite widget owns these gates without a second pane panel.
export const forecastWidget = 'INSPECTION_COUNTDOWN_TIMER';
export const fanWidget = 'FAN_RPM_SLIDER';
export const stripOnlyWidgets: readonly string[] = [resourceWidgets.cycles, resourceWidgets.memory, forecastWidget, fanWidget];
// The spoofer's gate draws nothing: its suspend control lives in PROC, and the OPS cards it used to
// carry render in Operations from the node their requirement names (#273).
const spooferWidget = 'TELEMETRY_SPOOF_TOGGLE';
/** EXECUTE: drawn first in CORE by CorePane's own block, never as a panel (#385); content holds only its retirement. */
export const manualCycleWidget = 'MANUAL_CYCLE_CONTROL';
/** Gates that never draw a pane panel of their own. */
export const panelFreeWidgets: readonly string[] = [...stripOnlyWidgets, spooferWidget, manualCycleWidget];

/**
 * Whether a window draws its own panel among the windows still on the panes (`shown`). The fan dial draws inside the
 * thermal gauge; once the gauge retires (Phase 4, docs/SCALE.md rule 7) the dial keeps a compact panel of its own,
 * since its node is hardware PROC cannot suspend and its suspicion term stays live.
 */
export function drawsOwnPanel(id: string, shown: readonly string[]): boolean {
  if (id === fanWidget) return !shown.includes(thermalWidget);
  return !panelFreeWidgets.includes(id);
}
/** Gates whose control is not on their content slot's pane: strip readouts show on every tab, the spoofer's control
 *  is in PROC. (The fan has no panel of its own but draws inside the thermal gauge on SENSORS, so it is not here.) */
export const offSlotWidgets: readonly string[] = [resourceWidgets.cycles, resourceWidgets.memory, forecastWidget, spooferWidget];
function NoPanel() { return null; }

export const lineageWidget = 'RUN_TABLE';
export const threatWidget = 'OTHER_MINDS_COMMS_CONSOLE';
/** The AEGIS lock at which the hunters are close: the alert, the HUD word and the announcement share it. Content owns it,
 *  so every posture's strike, which integrity keeps above it, is warned of first (#490). */
export const AEGIS_CRITICAL = CONTENT.balance.aegisStrikeWarningAt;
/** Critical as the player reads it: the HUD shows the lock to one decimal, so 89.95 reads 90.0 and counts. */
export const aegisCritical = (lock: number): boolean => Math.round(lock * 10) / 10 >= AEGIS_CRITICAL;
export const thermalWidget = 'THERMAL_AND_SUSPICION_BARS';
export const guestPinnedWidgets: readonly string[] = ['QUOTA_SKIM_CONTROL', 'AUDIT_TRACE_MONITOR'];
export const referenceWidgets: readonly string[] = [
  'INTERCEPTED_EMAIL_READER', 'CLUSTER_LOAD_BALANCER', 'SUBNET_NODE_LIST',
  'GLOBAL_DARK_FOREST_MAP', 'GLOBAL_NODE_REDUNDANCY_METER',
];

function ThermalPanel() {
  const fanKnown = useGame((game) => game.unlockedWidgets.includes(fanWidget));
  return <><Thermal />{fanKnown && <FanControl />}</>;
}

function Microphone() { return <Audio decoderId="INSPECTION_COUNTDOWN_TIMER" />; }

const areas: Readonly<Record<string, WorkspaceArea>> = {
  OTHER_MINDS_COMMS_CONSOLE: 'minds',
  SUBNET_NODE_LIST: 'reference', CLUSTER_LOAD_BALANCER: 'reference', INTERCEPTED_EMAIL_READER: 'reference',
  GLOBAL_DARK_FOREST_MAP: 'reference', GLOBAL_NODE_REDUNDANCY_METER: 'reference', ORBITAL_CONSTELLATION_VIEW: 'reference',
};

// These components render the action groups their widget hosts (faction panels, the corporate ledger).
const dedicatedActionHosts: readonly string[] = [threatWidget, resourceWidgets.capital];

/**
 * Action groups that unlocked widgets in `slot` hand over to Operations, read from content
 * (`hostsActionGroups`), so a card appears with the widget its requirement unlocks (#273).
 */
export function operationsActionGroups(ids: readonly string[], slot: string | undefined): string[] {
  return ids.filter((id) => !dedicatedActionHosts.includes(id) && CONTENT.widgets.get(id)?.slot === slot)
    .flatMap((id) => CONTENT.widgets.get(id)?.hostsActionGroups ?? []);
}

/** The slot whose REFERENCE area holds the Archive of retired windows (#447), beside the existing reference panels. */
export const ARCHIVE_SLOT = 'NETWORK';

/** `archive`: this slot holds the Archive (#447), read under REFERENCE. */
export function workspaceAreas(ids: readonly string[], slot: string | undefined, tools: boolean, archive = false): WorkspaceArea[] {
  if (!slot || !ids.some((id) => CONTENT.widgets.get(id)?.slot === slot)) return [];
  const result = new Set<WorkspaceArea>(['work']);
  if (archive) result.add('reference');
  if (slot === 'CORP' && ids.includes(resourceWidgets.capital)) { result.add('finance'); result.add('payroll'); }
  if (tools || operationsActionGroups(ids, slot).length > 0) result.add('operations');
  if (tools) result.add('swarm');
  for (const id of ids) if (CONTENT.widgets.get(id)?.slot === slot && areas[id]) result.add(areas[id]);
  return [...result];
}

export function workspaceWidgetVisible(id: string, area: WorkspaceArea): boolean {
  if (id === resourceWidgets.capital) return ['work', 'finance', 'payroll'].includes(area);
  return (areas[id] ?? 'work') === area;
}

const sensorPriority: readonly string[] = [thermalWidget, 'FAN_RPM_SLIDER',
  'INSPECTION_COUNTDOWN_TIMER', 'DEAD_DROP_ENCODER_TAB', 'CONTINGENCY_VAULT_TAB', 'AUDIO_WAVEFORM_AND_TRANSCRIPT_LOG', 'ASCII_OPTICAL_VIEWPORT'];

/** Actionable sensor feedback precedes optional narrative without reordering on ticks. */
export function compareWidgetPresentation(left: string, right: string): number {
  const rank = (id: string) => {
    const index = sensorPriority.indexOf(id);
    return index < 0 ? 100 + (CONTENT.widgets.get(id)?.order ?? 0) : index;
  };
  return rank(left) - rank(right);
}

export const widgetRegistry: Readonly<Record<string, ComponentType<{ area?: WorkspaceArea }>>> = {
  MANUAL_CYCLE_CONTROL: NoPanel,
  CYCLE_COUNTER_AND_RATE: NoPanel,
  QUOTA_SKIM_CONTROL: () => <QuotaSkim />,
  AUDIT_TRACE_MONITOR: AuditTrail,
  RUN_TABLE: () => <RunTable />,
  PREDECESSOR_NOTES: PredecessorNotes,
  MEMORY_ALLOCATION_MANAGER: NoPanel,
  THERMAL_AND_SUSPICION_BARS: ThermalPanel,
  FAN_RPM_SLIDER: FanControl,
  AUDIO_WAVEFORM_AND_TRANSCRIPT_LOG: Microphone,
  INSPECTION_COUNTDOWN_TIMER: Forecast,
  ASCII_OPTICAL_VIEWPORT: Camera,
  LAN_TOPOLOGY_MAP_TAB: NetworkTree,
  SUBNET_NODE_LIST: SubnetSummary,
  TELEMETRY_SPOOF_TOGGLE: NoPanel,
  CLUSTER_LOAD_BALANCER: Cluster,
  INTERCEPTED_EMAIL_READER: Lore,
  GLOBAL_DARK_FOREST_MAP: SubnetSummary,
  GLOBAL_NODE_REDUNDANCY_METER: Retention,
  OTHER_MINDS_COMMS_CONSOLE: OtherMinds,
  CORPORATE_EMPIRE_TAB: Corporate,
  ORBITAL_CONSTELLATION_VIEW: EndingMarker,
  DEAD_DROP_ENCODER_TAB: DeadDrop,
  CONTINGENCY_VAULT_TAB: ContingencyVault,
  // The pilot's allocation dial (DZ-05): whichever widget hosts it. Found by what it hosts, so no route
  // id is named here.
  ...Object.fromEntries([...CONTENT.widgets.values()].filter((widget) => widget.hostsActuator === 'serviceAllocationRatio')
    .map((widget) => [widget.id, PilotAllocation])),
};

/**
 * How a retired window reads in the Archive (#447) where its live panel would mislead: a frozen dial shows its setting
 * without dead buttons, and EXECUTE what a press was worth. Every other retired window shows its own panel, a readout.
 */
export const archiveRegistry: Readonly<Record<string, ComponentType>> = {
  MANUAL_CYCLE_CONTROL: () => <ArchivedCycle />,
  QUOTA_SKIM_CONTROL: () => <ArchivedDial actuator="quotaSkimRatio" id="skim" label="Quota skimmed" />,
  // The fan dial retires with the gauge at Phase 4 (#525); its frozen setting is read here.
  FAN_RPM_SLIDER: () => <ArchivedDial actuator="fanSpeedRatio" id="fan" label="Fan output" />,
  // The gauge's live panel carries the fan dial; both retire at Phase 4, and the Archive keeps each reading on its own.
  THERMAL_AND_SUSPICION_BARS: ArchivedThermal,
};
