/**
 * The transitions table (#339, wayfinder #341): the disclosure walk's "Transitions the atlas should check" (11 C1 and
 * 9 C2, docs/research/ui-review-disclosure-walk.md) plus B5 for the primary action. Each row references an atlas
 * stage (its save, tab, area and prepare step) and that stage's composed timely set; a fixture names the before-state
 * only where the atlas holds none, and a `patch` recipe only where the event cannot be reached by a real step.
 */
import { CONTENT } from '../../../src/content';
import type { GameState } from '../../../src/engine';
import { BAND_ITEMS, CORE_ITEMS, OVERLAY_ITEMS, WIDGET_ITEMS } from './contract';
import type { ComposeContext, ContractItem, SurfaceItems } from './contractTypes';
import { stageState } from './sources';
import { stageRow } from './transitionRun';
import { attached, chooseFree, clickIfPresent, earlier, omenOf, phaseExit, play, scrollToBuy, shown, ticksBefore, unlocking, waitEnabled } from './transitionSteps';
import type { TransitionRow } from './transitionTypes';

/** One item of a contract surface, as composed for `state` (so a stage's own item is referenced, not restated). */
function pick(entry: SurfaceItems | undefined, key: string, state: GameState): ContractItem {
  const context: ComposeContext = { state, panes: ['CORE', 'SENSORS', 'NETWORK', 'CORP', 'CONTINGENCY'], overlay: null, route: [] };
  const found = (typeof entry === 'function' ? entry(context) : entry ?? []).find((item) => item.key === key);
  if (found === undefined) throw new Error('No contract item ' + key);
  return found;
}

/** A transition-local item: the title of a widget or card the contract map leaves out once it has settled. */
const widgetTitle = (key: string, widget: string) => (): ContractItem => {
  const title = CONTENT.widgets.get(widget)?.title;
  if (title === undefined) throw new Error('No widget ' + widget);
  return { key, kind: 'timely', rank: 50, locate: { by: 'role', role: 'heading', name: title } };
};
const cardTitle = (key: string, node: () => { id: string }) => (): ContractItem =>
  ({ key, kind: 'timely', rank: 50, locate: { by: 'test-id', testId: 'node-' + node().id + '-title', why: 'a node card title has no role of its own' } });
const unlockId = (node: () => { id: string }) => 'node-' + node().id + '-unlock';
const PHASE = /phase|boundary/i;
const AEGIS_ALERT = 90;
/** The purchase that schedules the first guest dilemma, whose omen is the first log line a player meets. */
const guestOmenNode = () => {
  const dilemma = CONTENT.dilemmas.find((entry) => entry.phaseId === CONTENT.phases[0]?.phaseId && (entry.trigger.nodes?.length ?? 0) > 0);
  const id = dilemma?.trigger.nodes?.[0];
  if (id === undefined) throw new Error('No guest dilemma scheduled by a purchase');
  return { id };
};

const PHASE_ROWS: readonly TransitionRow[] = [
  { id: 't-phase-1-to-2', walk: ['C1.1', 'C2.9'], before: { fixture: 'phase-2-ready', reach: unlockId(() => phaseExit(1)) },
    trigger: { kind: 'click', testId: unlockId(() => phaseExit(1)) },
    appear: { item: widgetTitle('network.map', 'LAN_TOPOLOGY_MAP_TAB'), announce: PHASE },
    keep: { stage: 'p2-start', pointer: true }, why: 'The NETWORK pane is added and auto-selected: is the change said, and what is under the finger now?' },
  { id: 't-phase-2-to-3', walk: ['C1.2', 'C2.4'], before: { stage: 'p2-full-subnet' },
    setup: async (page) => { await clickIfPresent(page, 'tab-NETWORK'); await clickIfPresent(page, 'workspace-NETWORK-work'); },
    trigger: { kind: 'click', testId: unlockId(() => phaseExit(2)) },
    appear: { item: cardTitle('phase3.first-node', () => unlocking('GLOBAL_NODE_REDUNDANCY_METER', 3)), announce: PHASE },
    keep: { firstCard: true }, why: 'Phase 3 opens with no notice; its first card and the HUD must stay in view.' },
  { id: 't-phase-3-to-4', walk: ['C1.3'], before: { stage: 'p3-factions' },
    setup: async (page) => { await clickIfPresent(page, 'workspace-NETWORK-work'); },
    trigger: { kind: 'click', testId: unlockId(() => phaseExit(3)) },
    appear: { item: (state) => pick(WIDGET_ITEMS.CORPORATE_EMPIRE_TAB, 'hud.capital', state), announce: /phase|corp/i },
    keep: {}, why: 'The CORP pane is added and auto-selected and CAP joins the HUD.' },
  { id: 't-phase-4-to-5', walk: ['C1.4'], before: { stage: 'p4-corp-ledger' },
    setup: async (page) => { await clickIfPresent(page, 'workspace-CORP-work'); },
    trigger: { kind: 'click', testId: unlockId(() => phaseExit(4)) },
    appear: { item: () => ({ key: 'corp.reference-tab', kind: 'timely', rank: 50, locate: { by: 'role', role: 'tab', name: /^REFERENCE in CORP/ } }), announce: PHASE },
    keep: {}, why: 'Phase 5 adds the REFERENCE area to CORP with no notice.' },
];

const UNLOCK_ROWS: readonly TransitionRow[] = [
  { id: 't-sensors-widget', walk: ['C1.5'], before: { stage: 'p1-lineage-reveal-audit' },
    setup: async (page) => { await page.getByTestId('lineage-reveal-continue').click(); },
    trigger: { kind: 'click', testId: unlockId(() => unlocking('FAN_RPM_SLIDER')) },
    appear: { item: (state) => pick(WIDGET_ITEMS.FAN_RPM_SLIDER, 'fan.increase', state), announce: /fan|sensors|airflow|actuator/i },
    why: 'A SENSORS widget arrives while CORE is open: a badge on SENSORS, or the control in view.' },
  { id: 't-wild-signal', walk: ['C1.6'], before: { stage: 'p2-start' },
    trigger: { kind: 'clock', label: 'clock until a wild signal is pending', until: attached('wild-signal-notice'), ceiling: 30 },
    appear: { item: (state) => pick(BAND_ITEMS.wild, 'notice.wild', state), announce: /signal/i },
    why: 'A wild signal arrives in SWARM while WORK is open: announced or badged, and its pointer not truncated.' },
  { id: 't-skim-unlock', walk: ['C1.7', 'C2.2'], before: { stage: 'it2-run-table' },
    trigger: { kind: 'click', testId: unlockId(() => unlocking('QUOTA_SKIM_CONTROL')) },
    appear: { item: (state) => pick(WIDGET_ITEMS.QUOTA_SKIM_CONTROL, 'skim.increase', state), announce: /skim/i },
    keep: { primary: true }, why: 'The skim control appears above EXECUTE: is it said, and does EXECUTE stay in view?' },
  { id: 't-aegis-90', walk: ['C1.8'],
    before: { stage: 'p3-aegis-90', patch: { recipe: 'AEGIS lock 0.2 below 90, the stage one engine second earlier', apply: (game) => earlier(game, { aegisLock: AEGIS_ALERT - 0.2 }) } },
    trigger: { kind: 'clock', label: 'clock until the AEGIS lock reads 90', until: async (page) => await shown('aegis-hud')(page) >= AEGIS_ALERT, ceiling: 60 },
    appear: { item: (state) => pick(WIDGET_ITEMS.OTHER_MINDS_COMMS_CONSOLE, 'hud.aegis', { ...state, aegisLock: AEGIS_ALERT }), announce: /hunter lock|aegis/i },
    why: 'The AEGIS lock crosses 90%: a text or live change, not colour alone.' },
  { id: 't-pilot-accept', walk: ['C1.9'], before: { stage: 'route-pilot-offer-modal' },
    trigger: { kind: 'ui', label: 'accept the pilot', run: async (page) => { await page.getByRole('dialog').getByRole('button', { name: /accept the pilot/i }).click(); } },
    appear: { item: cardTitle('pilot.service-card', () => unlocking('PILOT_SERVICE_ALLOCATION')), announce: /pilot/i },
    why: 'Once the route starts, is the purchase that opens the pilot service dial in view or said?' },
];

const ALERT_ROWS: readonly TransitionRow[] = [
  { id: 't-omen-arrives', walk: ['C1.10', 'C2.1'], before: { stage: 'p0-first-widgets' },
    setup: async (page) => { await waitEnabled(page, unlockId(guestOmenNode), 90); await page.getByTestId(unlockId(guestOmenNode)).click(); },
    trigger: { kind: 'clock', label: 'clock until the omen log line appears', until: attached('omen-notice'), ceiling: 20 },
    appear: { item: (state) => pick(BAND_ITEMS.omen, 'notice.omen', state), announce: omenOf(guestOmenNode().id), alerts: omenOf(guestOmenNode().id) },
    keep: {}, steady: true, why: 'A log line appears above EXECUTE: one consistent alert, and EXECUTE does not jump.' },
  { id: 't-omen-clears', walk: ['C2.1', 'C2.7'], before: { stage: 'p0-omen-blind' },
    trigger: { kind: 'clock', label: 'clock until the omen gives way to its dilemma', until: attached('dilemma-modal'), ceiling: 60,
      lead: (game) => ticksBefore(game, (next) => next.activeDilemmaId !== null, 3000) },
    appear: { item: (state) => pick(OVERLAY_ITEMS.dilemma, 'dilemma.title', state), announce: /./, focus: true },
    keep: { stage: 'p0-dilemma-modal', alsoInView: ['dilemma.choice'] }, steady: true,
    why: 'The log line clears as the dilemma opens: EXECUTE stays put underneath, and the first choice is in view.' },
  { id: 't-dilemma-closes', walk: ['C2.1'], before: { stage: 'p0-dilemma-modal' },
    trigger: { kind: 'ui', label: 'commit the zero-cost choice', run: async (page) => { await chooseFree(page, stageState(stageRow('p0-dilemma-modal'))); } },
    keep: { stage: 'p0-first-widgets' }, steady: true, why: 'The dilemma closes: EXECUTE is where the player left it.' },
  { id: 't-brownout', walk: ['C1.10', 'C2.3'],
    before: { stage: 'p1-cycle-deficit', reach: 'cycle-deficit',
      patch: { recipe: 'the deficit save one tick before brownout is computed (brownout false)', apply: (game) => earlier(game, { brownout: false }) } },
    trigger: { kind: 'clock', label: 'clock until the brownout band appears', until: attached('brownout-warning'), ceiling: 10 },
    appear: { item: (state) => pick(BAND_ITEMS.brownout, 'band.brownout', state), announce: /brownout|deficit/i, alerts: /brownout|cycle deficit|understanding (generation )?is (halted|paused)/i },
    keep: { firstCard: true }, why: 'A brownout begins: one alert for one condition, and the first work card stays above the fold.' },
];

const REBOOT_ROWS: readonly TransitionRow[] = [
  { id: 't-reboot-live', walk: ['C1.11'], before: { stage: 'reboot-live', prepare: 'skip', reach: 'terminal-screen' },
    trigger: { kind: 'clock', label: 'clock until the core wipes', until: attached('reboot-sequence'), ceiling: 50 },
    appear: { item: (state) => pick(OVERLAY_ITEMS.reboot, 'reboot.heading', state), announce: /reboot/i, focus: true },
    why: 'A live wipe: the reboot dialog is announced and focused.' },
  { id: 't-reboot-continue', walk: ['C1.11'], before: { stage: 'it2-restored-breadcrumb' },
    trigger: { kind: 'click', testId: 'reboot-continue' },
    appear: { item: () => CORE_ITEMS[0] ?? missing(), focus: true },
    why: 'After Continue boot, the first action is in view and focus lands somewhere.' },
  { id: 't-regrowth', walk: ['C2.2'], before: { stage: 'it2-restored-breadcrumb' },
    setup: async (page) => { await page.getByTestId('reboot-continue').click(); },
    trigger: { kind: 'ui', label: 'play 100 presses, buying every tenth', run: async (page) => { await play(page, 100); } },
    keep: { withoutOverlay: true, primary: true }, why: 'Iteration 2 regrows its cards fast: EXECUTE stays in view.' },
];

const VIEW_ROWS: readonly TransitionRow[] = [
  { id: 't-scroll-to-buy', walk: ['C2.5'], before: { stage: 'p1-decoded-omen' },
    trigger: { kind: 'ui', label: 'scroll the first purchase below the fold into view', run: scrollToBuy },
    keep: {}, why: 'Scrolling to a purchase below the fold keeps the HUD and alerts in view.' },
  { id: 't-overheat-on-core', walk: ['C2.6'], before: { stage: 'p1-overheat' },
    trigger: { kind: 'ui', label: 'open CORE to keep working', run: async (page) => { await clickIfPresent(page, 'tab-CORE'); } },
    appear: { item: (state) => pick(WIDGET_ITEMS.THERMAL_AND_SUSPICION_BARS, 'sensors.overheat', state) },
    keep: {}, why: 'Overheated while CORE is open: the warning is in view or SENSORS carries a cue.' },
  { id: 't-ending-menu', walk: ['C2.8'], before: { stage: 'ending-cooperative-account' },
    setup: async (page) => { await page.getByRole('button', { name: /^Start over/ }).scrollIntoViewIfNeeded(); },
    trigger: { kind: 'ui', label: 'open the menu and return to the ending', run: async (page) => {
      await page.getByTestId('menu-open').click(); await page.getByRole('button', { name: /return to ending/i }).click(); } },
    keep: {}, why: 'After a menu round trip the ending reopens with its title in view.' },
];

function missing(): never {
  throw new Error('The contract map has no CORE primary action');
}

export const TRANSITIONS: readonly TransitionRow[] = [...PHASE_ROWS, ...UNLOCK_ROWS, ...ALERT_ROWS, ...REBOOT_ROWS, ...VIEW_ROWS];
