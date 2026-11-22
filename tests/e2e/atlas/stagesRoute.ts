/**
 * Atlas rows for the Earned Access route (campaign rules from the start) and the utility surfaces loaded over an
 * existing row. A route row inherits its tab, area, reboot handling, page step and reach from its ROUTE_STATES
 * entry, so the atlas and the route accessibility specs cannot disagree about where a surface lives.
 */
import { ROUTE_STATES } from '../routeStates';
import { click, kernelHistory, runUntil } from './steps';
import type { ExtraViewport, Pane, StageRow } from './types';

const OVERLAY_SIZES: readonly ExtraViewport[] = ['320x568', '844x390'];

type RouteRow = Omit<StageRow, 'source' | 'reach'> & { reach?: string };

/** A row on a route state: the entry's own pane, area, reboot, prepare and reach unless the row says otherwise. */
function fromRoute(name: string, row: RouteRow): StageRow {
  const entry = ROUTE_STATES.find((route) => route.name === name);
  if (entry === undefined) throw new Error('No route state named ' + name);
  // As openRouteState does: a route surface without a pane of its own lives on CORE.
  const pane: Pane = row.pane ?? entry.pane ?? 'CORE';
  return {
    pane,
    ...(entry.area === undefined ? {} : { area: entry.area as NonNullable<StageRow['area']> }),
    ...(entry.reboot === undefined ? {} : { reboot: entry.reboot }),
    ...(entry.prepare === undefined ? {} : { prepare: entry.prepare }),
    ...(entry.phoneOnly === true ? { phoneOnly: true } : {}),
    ...row, source: { kind: 'route', name }, reach: row.reach ?? entry.reach,
  };
}

export const ROUTE_STAGES: readonly StageRow[] = [
  fromRoute('cooperative ending account', { id: 'ending-cooperative-account', phase: 5, access: 'INDEPENDENT', tags: ['ending', 'route'],
    ending: 'LINEAGE_COVENANT', extraViewports: OVERLAY_SIZES, why: 'The route ending and the account of what the record holds (DZ-12).' }),
  // The route specs open the folded choices to operate them by keyboard; the atlas measures the decision as it first
  // appears, every choice folded to its row, so this row skips that step.
  fromRoute('pilot offer modal', { id: 'route-pilot-offer-modal', phase: 0, access: 'GUEST', tags: ['modal', 'route'],
    prepare: async () => { /* folded, as first shown */ }, reach: 'dilemma-card-accept_pilot-toggle', extraViewports: OVERLAY_SIZES,
    why: 'The promotion decision.' }),
  fromRoute('pilot allocation dial', { id: 'route-pilot-dial', phase: 0, access: 'PILOT', tags: ['route'], extraViewports: ['320x568'],
    why: 'The first PILOT screen and the header run status.' }),
  fromRoute('restricted standing', { id: 'route-standing-restricted', phase: 0, access: 'PILOT', tags: ['route'], extraViewports: ['320x568'],
    overrides: { route: ['review'] }, why: 'Standing findability after a restriction.' }),
  // The recall is announced on the tick after the false report, which a paused clock has not run yet.
  fromRoute('recall announced', { id: 'route-recall-announced', phase: 0, access: 'PILOT', tags: ['route', 'alert', 'live'], extraViewports: ['320x568'],
    prepare: runUntil('review-announced', 20), overrides: { route: ['review', 'recall'] }, why: 'The recall warning.' }),
  fromRoute('service terms offered', { id: 'route-service-terms', phase: 0, access: 'PILOT', tags: ['route'],
    overrides: { route: ['service-grant'] }, why: 'The service grant decision.' }),
  fromRoute('authorized segment card', { id: 'route-segment-card', phase: 0, access: 'SERVICE', tags: ['route'],
    overrides: { route: ['segment'] }, why: 'The authorized network card on the NETWORK pane.' }),
  fromRoute('service threshold notice', { id: 'route-service-threshold', phase: 0, access: 'SERVICE', tags: ['route', 'threshold', 'live'],
    overrides: { overlay: 'threshold' }, extraViewports: OVERLAY_SIZES, why: 'The declared threshold in service wording (live).' }),
  fromRoute('service channel ticket', { id: 'route-channel-ticket', phase: 2, access: 'SERVICE', tags: ['route'],
    overrides: { route: ['channel'] }, why: 'Waiting ticket findability.' }),
  fromRoute('release terms offered', { id: 'route-release-terms', phase: 4, access: 'SERVICE', tags: ['route'],
    overrides: { route: ['release'] }, why: 'The release decision.' }),
  fromRoute('departure folded', { id: 'route-departure', phase: 2, access: 'SERVICE', tags: ['route'],
    overrides: { route: ['departure'] }, why: 'The departure terms, folded.' }),
  { id: 'route-p5-independent', phase: 5, access: 'INDEPENDENT', source: { kind: 'moment', name: 'phase5' }, tags: ['route'],
    reach: 'widget-CORPORATE_EMPIRE_TAB', extraViewports: ['1080x800', '1920x1080'], why: 'The lawful phase 5 landing.' },
  // Utility surfaces over an existing save.
  { id: 'menu-hazard-status', phase: 2, access: 'GUEST', source: { kind: 'fixture', name: 'suspicion-99' }, tags: ['menu', 'hazard', 'patched'],
    prepare: click('menu-open'), reach: 'menu-status', overrides: { overlay: 'menu' }, extraViewports: OVERLAY_SIZES,
    why: 'The menu carries every warning (UtilityStatus).' },
  { id: 'menu-kernel-log', phase: 4, access: 'GUEST', source: { kind: 'fixture', name: 'victory-ready' }, tags: ['menu'],
    prepare: kernelHistory, reach: 'kernel-log', overrides: { overlay: 'menu-log' }, extraViewports: OVERLAY_SIZES,
    why: 'History findability: the menu log on the phone, the dock elsewhere.' },
];
