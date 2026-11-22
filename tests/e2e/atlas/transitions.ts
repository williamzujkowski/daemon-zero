/**
 * The transitions table (#339, wayfinder #341): the disclosure walk's "Transitions the atlas should check" (11 C1 and
 * 9 C2, docs/research/ui-review-disclosure-walk.md) plus B5 for the primary action. Each row references an atlas
 * stage (its save, tab, area and prepare step) and that stage's composed timely set; a labelled `patch` recipe
 * edits it only where the event cannot be reached by a real step (vote-1795150222283-8vx17o6).
 */
import { CONTENT } from '../../../src/content';
import { pilotServiceView, type GameState } from '../../../src/engine';
import { BAND_ITEMS, CORE_ITEMS, OVERLAY_ITEMS, WIDGET_ITEMS } from './contract';
import type { RegistryNode } from '../../../src/content/registry';
import type { ComposeContext, ContractItem, SurfaceItems } from './contractTypes';
import { stageState } from './sources';
import { stageRow } from './transitionRun';
import { attached, chooseFree, clickIfPresent, earlier, omenOf, phaseExit, play, pressUntil, scrollToBuy, shown, ticksBefore, unlocking, waitEnabled } from './transitionSteps';
import type { TransitionRow } from './transitionTypes';
import { press, openChoices } from '../helpers';

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
/** The ending's game-menu launcher, where focus returns after a menu round trip. */
const ENDING_LAUNCHER: ContractItem = { key: 'ending.menu-launcher', kind: 'timely', rank: 50,
  locate: { by: 'test-id', testId: 'menu-open', why: 'the launcher is named by its role elsewhere; the test id is unique here' } };
/** The purchase that schedules the first guest dilemma, whose omen is the first log line a player meets. */
const guestOmenNode = () => {
  const dilemma = CONTENT.dilemmas.find((entry) => entry.phaseId === CONTENT.phases[0]?.phaseId && (entry.trigger.nodes?.length ?? 0) > 0);
  const id = dilemma?.trigger.nodes?.[0];
  if (id === undefined) throw new Error('No guest dilemma scheduled by a purchase');
  return { id };
};

const PHASE_ROWS: readonly TransitionRow[] = [
  { id: 't-phase-1-to-2', walk: ['C1.1', 'C2.9'], before: { stage: 'p1-exit-ready' },
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
    // The thermal gauge and its strip readout retire at Phase 4 (docs/SCALE.md rule 7, UI-SPEC "Window retirement").
    keep: { retired: ['hud.thermal'] }, why: 'The CORP pane is added and auto-selected, CAP joins the HUD and thermal leaves it.' },
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
    trigger: { kind: 'ui', label: 'accept the pilot', run: async (page) => { await openChoices(page); await page.getByRole('dialog').getByRole('button', { name: /^Commit directive: accept the pilot/i }).click(); } },
    appear: { item: cardTitle('pilot.service-card', () => unlocking('PILOT_SERVICE_ALLOCATION')), announce: /pilot/i },
    why: 'Once the route starts, is the purchase that opens the pilot service dial in view or said?' },
];

const ALERT_ROWS: readonly TransitionRow[] = [
  { id: 't-omen-arrives', walk: ['C1.10', 'C2.1'], before: { stage: 'p0-first-widgets' },
    setup: async (page) => { await waitEnabled(page, unlockId(guestOmenNode), 90); await press(page, unlockId(guestOmenNode)); },
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
    // vote-1795202661293-vk191wx (7 of 7): focus returns to the launcher and the player keeps their place, as in
    // every utility menu (WCAG 2.4.3). The title-in-view expectation is dropped for this transition.
    appear: { item: () => ENDING_LAUNCHER, focus: 'menu-open' },
    why: 'After a menu round trip the ending returns focus to the menu launcher, in view, so the player keeps their place.' },
];

/**
 * The save one purchase earlier: the node, and the widget it unlocks, taken back out and its price refunded. Only
 * for a node nothing else owned descends from: the codec restores an owned node's ancestors (save.ts withAncestors).
 */
const without = (game: GameState, node: RegistryNode): Partial<GameState> => ({
  unlockedNodes: game.unlockedNodes.filter((id) => id !== node.id),
  unlockedWidgets: game.unlockedWidgets.filter((id) => id !== node.unlocksUiComponent),
  cycles: game.cycles + node.cost.cycles, understanding: game.understanding + node.cost.understanding,
});
/** A node's prerequisites, every generation, parents first: the purchases a player makes before it is offered. */
function ancestors(node: RegistryNode): string[] {
  const out: string[] = [];
  const visit = (id: string): void => {
    for (const parent of CONTENT.nodes.get(id)?.prerequisites ?? []) visit(parent);
    if (id !== node.id && !out.includes(id)) out.push(id);
  };
  visit(node.id);
  return out;
}
const thermalNode = () => unlocking('THERMAL_AND_SUSPICION_BARS');
const beacon = () => unlocking('OTHER_MINDS_COMMS_CONSOLE', 3);
/** The power-consuming upgrade, found by what it does: a phase 4 repeatable that draws megawatts. */
const powerDraw = () => {
  const rep = [...CONTENT.repeatables.values()].find((entry) => entry.phaseId === 4 && entry.perLevel.wattsDelta < 0);
  if (rep === undefined) throw new Error('No phase 4 repeatable draws power');
  return rep;
};
/** Levels of the power draw that bring consumption level with generation, so one more is a shortfall. */
function levelWithGeneration(game: GameState): GameState {
  const rep = powerDraw();
  const surplus = game.rates.wattsGenerated - game.rates.wattsConsumed;
  const level = (game.levels[rep.id] ?? 0) + Math.floor(surplus / -rep.perLevel.wattsDelta);
  return earlier(game, { levels: { ...game.levels, [rep.id]: level } });
}
/**
 * C2.3's three banners: insolvent and in a brownout at once (every cycle and capital producer suspended, the
 * cycle-earning operatives released), overheated, and suspicion a breath under rung 3 so the clock escalates it.
 */
function threeBanners(game: GameState): GameState {
  const producers = [...CONTENT.nodes.values()].filter((node) => game.unlockedNodes.includes(node.id)
    && (node.tickDelta.cyclesPerSec > 0 || node.tickDelta.capitalPerSec > 0 || node.tickDelta.suspicionPerSec < 0)).map((node) => node.id);
  const levels = Object.fromEntries(Object.entries(game.levels).filter(([id]) => (CONTENT.repeatables.get(id)?.perLevel.cyclesPerSec ?? 0) <= 0));
  const rung = CONTENT.balance.escalation[2]?.at ?? 75;
  const state = earlier(game, { cycles: 0, capital: 0, brownout: true, insolvent: true, levels, thermal: 100, suspicion: rung - 0.5, alertLevel: 2,
    disabledNodes: [...new Set([...game.disabledNodes, ...producers])] });
  if (state.rates.cyclesPerSec >= 0 || state.rates.capitalPerSec >= 0) throw new Error('The three-banner recipe is not in deficit and insolvent');
  return state;
}
const REMEMBERED = /^\[REMEMBERED\] /;

/** The rows #353 added: the uncovered C1.10 conditions, the C2.3 banners together, and the later C1.5/C1.9/C1.11/C2.4 states. */
const COVERAGE_ROWS: readonly TransitionRow[] = [
  { id: 't-sensors-tab', walk: ['C1.5'],
    before: { stage: 'p1-thermal-blind', reach: 'terminal-screen',
      patch: { recipe: 'the thermal-unlocked save one purchase earlier (the thermal bus not yet mapped)', apply: (game) => earlier(game, without(game, thermalNode())) } },
    trigger: { kind: 'click', testId: unlockId(thermalNode) },
    appear: { item: (state) => pick(WIDGET_ITEMS.THERMAL_AND_SUSPICION_BARS, 'hud.thermal', state), announce: /sensors|thermal/i },
    why: 'Mapping the thermal bus adds the SENSORS tab and the thermal readout: is either said?' },
  // The beacon is an ancestor of most of phase 3, so no phase 3 save can lack it: the row crosses into phase 3 for real.
  { id: 't-factions-area', walk: ['C1.2', 'C2.4'], before: { stage: 'p2-full-subnet' },
    setup: async (page) => {
      await clickIfPresent(page, 'tab-NETWORK'); await clickIfPresent(page, 'workspace-NETWORK-work');
      await press(page, unlockId(() => phaseExit(2))); await page.clock.runFor(1000); await clickIfPresent(page, 'phase-threshold-continue');
      await clickIfPresent(page, 'workspace-NETWORK-work');
      for (const id of ancestors(beacon())) if (await page.getByTestId('node-' + id + '-unlock').count() > 0) await press(page, 'node-' + id + '-unlock');
    },
    trigger: { kind: 'click', testId: unlockId(beacon) },
    appear: { item: () => ({ key: 'network.factions-tab', kind: 'timely', rank: 50, locate: { by: 'role', role: 'tab', name: /^FACTIONS in NETWORK/ } }), announce: /faction|other minds/i },
    keep: { stage: 'p3-factions', firstCard: true }, why: 'The FACTIONS area joins the NETWORK sub-tabs later in phase 3: does the row wrap push the first card down?' },
  { id: 't-batch-complete', walk: ['C1.9'], before: { stage: 'route-pilot-dial' },
    trigger: { kind: 'clock', label: 'clock until the batch completes and SUBMIT is enabled', ceiling: 60,
      until: async (page) => await page.getByTestId('pilot-service-submit').isEnabled().catch(() => false),
      lead: (game) => ticksBefore(game, (next) => pilotServiceView(next, CONTENT)?.complete === true, 6000) },
    appear: { item: () => ({ key: 'pilot.submit', kind: 'primary', rank: 50, locate: { by: 'role', role: 'button', name: /^Submit batch for review/ } }), announce: /batch complete|submit/i },
    why: 'The batch completes while the player works: is Submit batch for review in view or said?' },
  { id: 't-remembered-card', walk: ['C1.11'], before: { stage: 'it2-restored-breadcrumb' },
    setup: async (page) => { await page.getByTestId('reboot-continue').click(); },
    trigger: { kind: 'ui', label: 'press EXECUTE until the first [REMEMBERED] card is offered', run: async (page) => {
      await pressUntil(page, async () => await page.getByRole('heading', { name: REMEMBERED }).count() > 0, 600); } },
    appear: { item: () => ({ key: 'core.remembered-card', kind: 'timely', rank: 50, locate: { by: 'role', role: 'heading', name: REMEMBERED } }) },
    keep: { withoutOverlay: true, primary: true }, why: 'After Continue the first [REMEMBERED] card arrives: is it in view, with EXECUTE?' },
  { id: 't-insolvent', walk: ['C1.10'],
    before: { stage: 'p4-insolvent', reach: 'terminal-screen',
      patch: { recipe: 'the insolvent save one tick earlier (capital 0.01, not yet insolvent)', apply: (game) => earlier(game, { capital: 0.01, insolvent: false }) } },
    trigger: { kind: 'clock', label: 'clock until the insolvency band appears', until: attached('insolvency-warning'), ceiling: 10 },
    appear: { item: (state) => pick(BAND_ITEMS.insolvent, 'band.insolvent', state), announce: /insolvent/i, alerts: /insolvent|capital exhausted/i },
    keep: {}, why: 'Capital runs out: one alert for one condition, and the timely set stays in view.' },
  { id: 't-power-shortfall', walk: ['C1.10'],
    before: { stage: 'p4-corp-ledger', reach: 'terminal-screen',
      patch: { recipe: 'the victory-ready save with the power draw levelled to generation (consumption = generation)', apply: levelWithGeneration } },
    setup: async (page) => { await clickIfPresent(page, 'workspace-CORP-work'); },
    trigger: { kind: 'click', testId: 'rep-' + powerDraw().id + '-buy' },
    appear: { item: (state) => pick(BAND_ITEMS.shortfall, 'band.shortfall', state), announce: /power shortfall/i, alerts: /power shortfall|MW short/i },
    // No C2 here: the upgrade sits below the phone fold, so pressing it is t-scroll-to-buy's scroll (#365) over again.
    why: 'One more power-drawing upgrade tips the grid short: the band is in view, and one alert says so.' },
  { id: 't-three-banners', walk: ['C2.3', 'C1.10'],
    before: { stage: 'p4-insolvent', reach: 'brownout-warning',
      patch: { recipe: 'the insolvent save in a brownout (cycle producers suspended), thermal 100, suspicion 0.5 under rung 3', apply: threeBanners } },
    trigger: { kind: 'clock', label: 'clock until the response escalates', until: attached('response-notice'), ceiling: 50 },
    appear: { item: (state) => pick(OVERLAY_ITEMS['response-notice'], 'notice.response', state), announce: /RESPONSE ESCALATED/, alerts: /^RESPONSE/ },
    keep: { firstCard: true }, why: 'Brownout, insolvent and response banners together at 390x844: the first work card stays above the fold.' },
];

function missing(): never {
  throw new Error('The contract map has no CORE primary action');
}

export const TRANSITIONS: readonly TransitionRow[] = [...PHASE_ROWS, ...UNLOCK_ROWS, ...ALERT_ROWS, ...REBOOT_ROWS, ...VIEW_ROWS, ...COVERAGE_ROWS];
