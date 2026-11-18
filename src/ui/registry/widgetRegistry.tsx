/**
 * The only UI boundary allowed to know widget identifiers.
 * Slots and titles remain content data; presentation priority stays at this boundary.
 */
import type { ComponentType } from 'react';
import { CONTENT } from '../../content';
import { AuditTrail, Forecast, Thermal } from '../widgets/Readouts';
import FanControl, { QuotaSkim } from '../widgets/FanControl';
import { Audio, Camera } from '../widgets/Sensory';
import DeadDrop from '../widgets/DeadDrop';
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
/** Gates that never draw a pane panel of their own. */
export const panelFreeWidgets: readonly string[] = [...stripOnlyWidgets, spooferWidget];
function NoPanel() { return null; }

export const lineageWidget = 'RUN_TABLE';
export const threatWidget = 'OTHER_MINDS_COMMS_CONSOLE';
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

export function workspaceAreas(ids: readonly string[], slot: string | undefined, tools: boolean): WorkspaceArea[] {
  if (!slot || !ids.some((id) => CONTENT.widgets.get(id)?.slot === slot)) return [];
  const result = new Set<WorkspaceArea>(['work']);
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
  'INSPECTION_COUNTDOWN_TIMER', 'DEAD_DROP_ENCODER_TAB', 'AUDIO_WAVEFORM_AND_TRANSCRIPT_LOG', 'ASCII_OPTICAL_VIEWPORT'];

/** Actionable sensor feedback precedes optional narrative without reordering on ticks. */
export function compareWidgetPresentation(left: string, right: string): number {
  const rank = (id: string) => {
    const index = sensorPriority.indexOf(id);
    return index < 0 ? 100 + (CONTENT.widgets.get(id)?.order ?? 0) : index;
  };
  return rank(left) - rank(right);
}

export const widgetRegistry: Readonly<Record<string, ComponentType<{ area?: WorkspaceArea }>>> = {
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
  // Preview only (DZ-05): whichever widget hosts the pilot's allocation dial. Found by what it hosts, so
  // no preview id ships in production, whose content hosts no such dial and adds nothing here.
  ...Object.fromEntries([...CONTENT.widgets.values()].filter((widget) => widget.hostsActuator === 'serviceAllocationRatio')
    .map((widget) => [widget.id, PilotAllocation])),
};
