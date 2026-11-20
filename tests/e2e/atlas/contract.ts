/**
 * The information contract's map (#339): every surface a save can unlock (chrome, each widget, the alert band,
 * notices, overlays, the ending, the route's surfaces) to the items it must expose. compose.ts composes a stage
 * from this map and the save. Every widget in content has an entry; an empty list is a recorded decision that the
 * widget holds nothing a player must watch or act on to understand the game now.
 */
import { CONTENT } from '../../../src/content';
import { offeredChoices, understandsSurveillance, type GameState } from '../../../src/engine';
import { SEGMENT } from '../../network-helpers';
import type { ContractItem, ItemKind, Locate, SurfaceItems } from './contractTypes';
import type { OverlayId, Pane, RouteSurface } from './types';

const role = (r: Extract<Locate, { by: 'role' }>['role'], name: string | RegExp): Locate => ({ by: 'role', role: r, name });
const testId = (id: string, why: string): Locate => ({ by: 'test-id', testId: id, why });
/** How many choices the active dilemma offers this world (the modal renders its index only for more than one). */
const offeredCount = (state: GameState): number => {
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === state.activeDilemmaId);
  return dilemma ? offeredChoices(state, dilemma, CONTENT).length : 0;
};
const alert = (text: RegExp): Locate => ({ by: 'role-text', role: 'alert', text, why: 'an alert takes no name from its content' });
function item(key: string, kind: ItemKind, locate: Locate, rank: number, pane?: Pane): ContractItem {
  return pane === undefined ? { key, kind, locate, rank } : { key, kind, locate, rank, pane };
}
/** An item found inside the open dialog. */
const inDialog = (entry: ContractItem): ContractItem => ({ ...entry, inDialog: true });

const READOUT = 'role-less strip readout (Text with a label, no role)';
export const OVERHEAT = CONTENT.balance.thermalThresholdForSuspicion;

export const CHROME: readonly ContractItem[] = [
  item('chrome.status', 'region', role('region', /^(Run status|Terminal status)$/), 90),
  item('chrome.menu', 'primary', role('button', /Game menu$/), 95),
];

export const WIDGET_ITEMS: Readonly<Record<string, SurfaceItems>> = {
  CYCLE_COUNTER_AND_RATE: [item('hud.cycles', 'timely', testId('res-cycles', READOUT), 30)],
  QUOTA_SKIM_CONTROL: [item('skim.increase', 'primary', role('button', /^\+ Increase quota skimmed/), 60, 'CORE')],
  AUDIT_TRACE_MONITOR: ({ state }) => {
    const known = understandsSurveillance(state, CONTENT);
    const items = [item('hud.understanding', 'timely', testId('res-understanding', READOUT), 35)];
    if (known) items.push(item('hud.suspicion', 'timely', role('meter', /^Suspicion: /), 20));
    if (known && state.alertLevel > 0) items.push(item('audit.response', 'timely', testId('alert-level', 'the response rung is plain text'), 18, 'CORE'));
    if (!known && state.currentPhase > (CONTENT.phases[0]?.phaseId ?? 0)) {
      items.push(item('hud.blind-audit', 'timely', testId('blind-audit-status', 'the blind audit band has no role'), 22));
    }
    return items;
  },
  RUN_TABLE: [],
  PREDECESSOR_NOTES: [],
  MEMORY_ALLOCATION_MANAGER: [item('hud.memory', 'timely', testId('res-memory', READOUT), 36)],
  THERMAL_AND_SUSPICION_BARS: ({ state }) => [
    item('hud.thermal', 'timely', role('meter', /^Thermal: /), 20),
    ...(state.thermal > OVERHEAT ? [item('sensors.overheat', 'timely',
      { by: 'text', text: /^WARNING: overheat/, why: 'the overheat warning is plain text with no role or test id' }, 10, 'SENSORS')] : []),
  ],
  FAN_RPM_SLIDER: [item('fan.increase', 'primary', role('button', /^\+ Increase fan output/), 60, 'SENSORS')],
  AUDIO_WAVEFORM_AND_TRANSCRIPT_LOG: [],
  INSPECTION_COUNTDOWN_TIMER: [item('hud.forecast', 'timely', role('heading', 'Interrupt forecast'), 25)],
  ASCII_OPTICAL_VIEWPORT: [],
  LAN_TOPOLOGY_MAP_TAB: [],
  SUBNET_NODE_LIST: [],
  TELEMETRY_SPOOF_TOGGLE: [],
  CLUSTER_LOAD_BALANCER: [],
  INTERCEPTED_EMAIL_READER: [],
  GLOBAL_DARK_FOREST_MAP: [],
  GLOBAL_NODE_REDUNDANCY_METER: [],
  OTHER_MINDS_COMMS_CONSOLE: ({ state }) => [item('hud.aegis', 'timely', testId('aegis-hud', READOUT), state.aegisLock >= 90 ? 10 : 40)],
  CORPORATE_EMPIRE_TAB: [item('hud.capital', 'timely', testId('res-capital', READOUT), 37)],
  ORBITAL_CONSTELLATION_VIEW: [],
  DEAD_DROP_ENCODER_TAB: [item('deaddrop.wipe', 'destructive', role('button', 'Voluntary wipe'), 70, 'CONTINGENCY')],
  // The service share is a setting the player chose, not a readout that moves by itself: its control is the item.
  PILOT_SERVICE_ALLOCATION: [item('pilot.increase', 'primary', role('button', /^\+ Increase service share/), 40, 'CORE')],
};

/** The alert band and the notices, keyed by the condition compose.ts reads from the save. */
export const BAND_ITEMS = {
  insolvent: [item('band.insolvent', 'timely', alert(/^INSOLVENT: /), 5)],
  shortfall: [item('band.shortfall', 'timely', alert(/^POWER SHORTFALL: /), 5)],
  brownout: [item('band.brownout', 'timely', alert(/^BROWNOUT: cycle deficit/), 5)],
  omen: [item('notice.omen', 'timely', testId('omen-notice', 'a status region takes no name from its content; several notices share the band'), 12)],
  wild: [item('notice.wild', 'timely', role('button', /^SIGNAL PENDING \/\/ /), 15)],
} as const satisfies Readonly<Record<string, readonly ContractItem[]>>;

const dialog = (key: string, name: string | RegExp) => item(key + '.dialog', 'region', role('dialog', name), 90);

/** Overlays that hold the screen: the stage's contract is the overlay alone, and what is under it is occluded. */
export const OVERLAY_ITEMS: Readonly<Record<OverlayId | 'dilemma' | 'ending', SurfaceItems>> = {
  // The choice index (vote-1795206922704-4ljmpd2, #371) is timely whenever more than one choice is offered, so
  // the fold gate holds every alternative and its cost in the first view.
  dilemma: ({ state }) => [dialog('dilemma', /./), inDialog(item('dilemma.title', 'timely', role('heading', /./), 1)),
    inDialog(item('dilemma.choice', 'primary', role('button', /^(Commit directive|Unavailable): /), 2)),
    ...(offeredCount(state) > 1 ? [inDialog(item('dilemma.index', 'timely', testId('dilemma-index', 'a group of jump rows has no role of its own'), 3))] : [])],
  reboot: [dialog('reboot', /^(Restored checkpoint|Core reboot)$/), inDialog(item('reboot.heading', 'timely', role('heading', /^(RESTORED CHECKPOINT|REBOOT)/), 1)),
    inDialog(item('reboot.continue', 'primary', role('button', 'Continue boot'), 2))],
  threshold: [dialog('threshold', /./), inDialog(item('threshold.heading', 'timely', role('heading', /./), 1)),
    inDialog(item('threshold.continue', 'primary', role('button', /./), 2))],
  'lineage-reveal': [dialog('reveal', 'Discovery decoded'), inDialog(item('reveal.heading', 'timely', role('heading', /./), 1)),
    inDialog(item('reveal.continue', 'primary', role('button', 'Continue after discovery'), 2))],
  'confirm-wipe': [dialog('confirm', 'Voluntary wipe'), inDialog(item('confirm.wipe', 'destructive', role('button', 'Confirm Voluntary wipe'), 3)),
    inDialog(item('confirm.cancel', 'primary', role('button', 'Cancel Voluntary wipe'), 2))],
  proc: [dialog('proc', 'Daemon processes'), inDialog(item('proc.close', 'primary', role('button', 'Close daemon processes'), 2))],
  menu: ({ state }) => [dialog('menu', 'Game menu'), inDialog(item('menu.close', 'primary', role('button', 'Close game menu'), 2)),
    ...(menuWarns(state) ? [inDialog(item('menu.status', 'timely', testId('menu-status', 'the warning list has no role'), 1))] : [])],
  'menu-log': [dialog('log', /^(Game menu|Kernel log history)$/), inDialog(item('log.list', 'region', testId('kernel-log', 'the log list has no role'), 80)),
    inDialog(item('log.close', 'primary', role('button', /^Close (game menu|kernel log)$/), 2))],
  'response-notice': [item('notice.response', 'timely', alert(/^RESPONSE (ESCALATED|STAND-DOWN)/), 8),
    item('notice.response-ack', 'primary', role('button', /acknowledge human response change$/), 9)],
  ending: ({ state }) => [dialog('ending', endingTitle(state)), inDialog(item('ending.title', 'timely', role('heading', endingTitle(state)), 1)),
    inDialog(item('ending.start-over', 'destructive', role('button', /^Start over/), 70))],
};

/** Overlays that sit beside the running view rather than over it. */
export const NON_BLOCKING: ReadonlySet<OverlayId> = new Set(['response-notice']);

export const ROUTE_ITEMS: Readonly<Record<RouteSurface, readonly ContractItem[]>> = {
  assignment: [item('route.assignment', 'primary', role('button', /^Accept assignment: /), 40, 'CORE')],
  review: [item('route.standing', 'timely', testId('review-standing', 'the standing line is plain text'), 18, 'CORE')],
  recall: [item('route.recall', 'timely', alert(/^Recall review announced/), 6, 'CORE')],
  'service-grant': [item('route.service-accept', 'primary', role('button', /^Accept service: /), 40, 'CORE')],
  segment: [item('route.segment', 'region', testId('node-' + SEGMENT, 'a node card has no role'), 80, 'NETWORK')],
  channel: [item('route.channel-refer', 'primary', role('button', /^Refer onward: /), 40, 'CORE')],
  release: [item('route.release', 'primary', role('button', /^Negotiate release: /), 40, 'CORE')],
  departure: [item('route.departure', 'primary', role('button', /^Review departure: /), 40, 'CORE')],
};

/** The primary action of the CORE pane on every tier. */
export const CORE_ITEMS: readonly ContractItem[] = [item('core.cycle', 'primary', role('button', /execute clock cycle$/i), 50, 'CORE')];

function endingTitle(state: GameState): string {
  const ending = CONTENT.endings.find((entry) => entry.id === state.ending);
  if (ending === undefined) throw new Error('Unmapped surface: ending ' + String(state.ending));
  return ending.title;
}

/** The warnings UtilityStatus carries into the menu (src/ui/UtilityStatus.tsx), read from the same fields. */
export function menuWarns(state: GameState): boolean {
  const has = (id: string) => state.unlockedWidgets.includes(id);
  const { rates } = state;
  return (has('CYCLE_COUNTER_AND_RATE') && (state.brownout || rates.cyclesPerSec < 0)) || (has('CORPORATE_EMPIRE_TAB') && state.insolvent)
    || (has('CORPORATE_EMPIRE_TAB') && rates.megawattsGenerated < rates.megawattsConsumed)
    || (has('THERMAL_AND_SUSPICION_BARS') && state.thermal > OVERHEAT) || (understandsSurveillance(state, CONTENT) && state.alertLevel > 0)
    || (has('OTHER_MINDS_COMMS_CONSOLE') && state.aegisLock >= 90) || state.pendingDilemma !== null;
}
