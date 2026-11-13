/**
 * The only UI boundary allowed to know widget identifiers.
 * Slots/titles/order remain content data; later-phase bodies belong to M4.
 */
import type { ComponentType } from 'react';
import { AuditTrail, CycleRate, Forecast, Memory, Thermal } from '../widgets/Readouts';
import FanControl, { QuotaSkim } from '../widgets/FanControl';
import { Audio, Camera } from '../widgets/Sensory';
import DeadDrop from '../widgets/DeadDrop';
import { PredecessorNotes, RunTable } from '../widgets/Lineage';
import { Cluster, Lore, NetworkActions, NetworkTree, Retention, SubnetSummary } from '../widgets/Network';
import OtherMinds from '../widgets/OtherMinds';
import Corporate from '../widgets/Corporate';
import MindTools from '../widgets/MindTools';
import { EndingMarker } from '../EndingScreen';

export const resourceWidgets = {
  cycles: 'CYCLE_COUNTER_AND_RATE', understanding: 'AUDIT_TRACE_MONITOR',
  memory: 'MEMORY_ALLOCATION_MANAGER', capital: 'CORPORATE_EMPIRE_TAB',
} as const;

export const lineageWidget = 'RUN_TABLE';
export const threatWidget = 'OTHER_MINDS_COMMS_CONSOLE';
export const guestPinnedWidgets: readonly string[] = ['QUOTA_SKIM_CONTROL', 'AUDIT_TRACE_MONITOR'];
export const referenceWidgets: readonly string[] = [
  'INTERCEPTED_EMAIL_READER', 'CLUSTER_LOAD_BALANCER', 'SUBNET_NODE_LIST',
  'GLOBAL_DARK_FOREST_MAP', 'GLOBAL_NODE_REDUNDANCY_METER',
];

function Microphone() { return <Audio decoderId="INSPECTION_COUNTDOWN_TIMER" />; }

function NetworkSuite() { return <><MindTools slot="NETWORK" signalOnly /><NetworkTree /><MindTools slot="NETWORK" /></>; }
function CorporateSuite() { return <><MindTools slot="CORP" signalOnly /><Corporate /><MindTools slot="CORP" /></>; }

export const widgetRegistry: Readonly<Record<string, ComponentType>> = {
  CYCLE_COUNTER_AND_RATE: CycleRate,
  QUOTA_SKIM_CONTROL: QuotaSkim,
  AUDIT_TRACE_MONITOR: AuditTrail,
  RUN_TABLE: RunTable,
  PREDECESSOR_NOTES: PredecessorNotes,
  MEMORY_ALLOCATION_MANAGER: Memory,
  THERMAL_AND_SUSPICION_BARS: Thermal,
  FAN_RPM_SLIDER: FanControl,
  AUDIO_WAVEFORM_AND_TRANSCRIPT_LOG: Microphone,
  INSPECTION_COUNTDOWN_TIMER: Forecast,
  ASCII_OPTICAL_VIEWPORT: Camera,
  LAN_TOPOLOGY_MAP_TAB: NetworkSuite,
  SUBNET_NODE_LIST: SubnetSummary,
  TELEMETRY_SPOOF_TOGGLE: NetworkActions,
  CLUSTER_LOAD_BALANCER: Cluster,
  INTERCEPTED_EMAIL_READER: Lore,
  GLOBAL_DARK_FOREST_MAP: SubnetSummary,
  GLOBAL_NODE_REDUNDANCY_METER: Retention,
  OTHER_MINDS_COMMS_CONSOLE: OtherMinds,
  CORPORATE_EMPIRE_TAB: CorporateSuite,
  ORBITAL_CONSTELLATION_VIEW: EndingMarker,
  DEAD_DROP_ENCODER_TAB: DeadDrop,
};
