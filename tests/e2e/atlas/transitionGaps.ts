/**
 * Measured transition failures of today's UI (#341, #339), recorded under the same rule as the stage atlas's
 * KNOWN_GAPS (knownGaps.ts): the checks keep their thresholds and every row stays in the table, each entry is
 * asserted to STILL fail, and a fix flips the cell and forces the entry out. `measured` is what the first run
 * recorded; `issue` is the filed issue the fix lands
 * under (#343 filed them). Never add an entry without measuring it.
 */
import type { KnownGap } from './knownGaps';
import type { TransitionRule } from './transitionCheck';

const HOST_EXIT = 'host to subnet adds and auto-selects the NETWORK pane with no notice, no live text and focus left where it was; only the kernel log (not a live region) says PHASE_2_INITIATED (walk A1, B2)';
const PHASE = 'phase changes after the first open no notice and write no phase live text (walk A1); the one live text is a RESPONSE ESCALATED alert that the crossing\'s suspicion raises';
const BADGE = 'a widget that arrives on a pane the phone is not showing puts no attention marker on that pane\'s tab (walk A2); the route\'s CORE badge (#284) is the pattern to copy';
const UNLOCK = 'a purchase that unlocks a control writes only a kernel log line, which is not a live region, and moves no focus (walk A2, B7)';
const WILD = 'a wild signal arrives with no live text and no marker on the SWARM area (walk A2)';
const WILD_CUT = 'the "SIGNAL PENDING // <name>" pointer is held to one line and cut with an ellipsis at 390 (walk A4)';
const AEGIS = 'the hunter-lock alert lives in the OTHER_MINDS widget, which only the FACTIONS area renders; elsewhere the AEGIS readout only turns red (walk A5)';
const PILOT = 'after accepting the pilot, the purchase that opens the service dial is the last card in CORE (about 2.8k px down at 390, 1.9k at 1440) and nothing names it (walk B3)';
const OMEN_ROLE = 'the omen log line is role=alert with aria-live=polite: its role and its politeness disagree (walk X2)';
const OMEN_IN = 'the omen band is inserted above EXECUTE in the same flow and pushes it down (walk B1)';
const OMEN_OUT = 'the omen band is removed above EXECUTE when its dilemma opens, so EXECUTE jumps back up under the modal (walk B1)';
const BROWNOUT = 'one brownout raises two alerts: the chrome band (brownout-warning) and the CORE deficit hint (cycle-deficit) (walk A6, X2)';
const OVERHEAT = 'overheated with CORE open, the SENSORS tab carries no marker while the warning and the fan control live on SENSORS (walk C-b, C2.6)';
const ENDING = 'the ending keeps its scroll offset across a menu round trip, so a player who scrolled to Start over returns with the title above the view (walk X3)';
const FOCUS = 'Continue boot closes the reboot dialog without moving focus, which falls to the page body (walk X3)';
const SCROLL = 'on the phone the HUD, forecast and notices scroll with the cards, so reaching a purchase below the fold takes every timely readout out of view (walk C-b)';

export const TRANSITION_GAPS: readonly KnownGap<TransitionRule>[] = [
  { stage: 't-aegis-90', viewport: '1440x900', item: 'hud.aegis', rule: 'new-announced', measured: 'live alert: RESPONSE ESCALATEDNOMINAL → TICKET OPEN[ ACK ]', reason: AEGIS, issue: '#360' },
  { stage: 't-aegis-90', viewport: '390x844', item: 'hud.aegis', rule: 'new-announced', measured: 'live alert: RESPONSE ESCALATEDNOMINAL → TICKET OPEN[ ACK ]', reason: AEGIS, issue: '#360' },
  { stage: 't-brownout', viewport: '1440x900', item: 'alerts', rule: 'one-alert', measured: 'value 2; brownout-warning, cycle-deficit', reason: BROWNOUT, issue: '#363' },
  { stage: 't-brownout', viewport: '390x844', item: 'alerts', rule: 'one-alert', measured: 'value 2; brownout-warning, cycle-deficit', reason: BROWNOUT, issue: '#363' },
  { stage: 't-ending-menu', viewport: '390x844', item: 'ending.title', rule: 'timely-kept', measured: 'box 16,-432,358,22; visibleRatio 0; fold 828', reason: ENDING, issue: '#364' },
  { stage: 't-omen-arrives', viewport: '1440x900', item: 'core.cycle', rule: 'primary-shift', measured: 'box 356,336,224,44; value 35; y 301 -> 336', reason: OMEN_IN, issue: '#362' },
  { stage: 't-omen-arrives', viewport: '1440x900', item: 'omen-notice', rule: 'politeness', measured: 'role=alert aria-live=polite', reason: OMEN_ROLE, issue: '#363' },
  { stage: 't-omen-arrives', viewport: '390x844', item: 'core.cycle', rule: 'primary-shift', measured: 'box 16,343,358,44; value 54; y 289 -> 343', reason: OMEN_IN, issue: '#362' },
  { stage: 't-omen-arrives', viewport: '390x844', item: 'omen-notice', rule: 'politeness', measured: 'role=alert aria-live=polite', reason: OMEN_ROLE, issue: '#363' },
  { stage: 't-omen-clears', viewport: '1440x900', item: 'core.cycle', rule: 'primary-shift', measured: 'box 356,301,224,44; value 35; y 336 -> 301', reason: OMEN_OUT, issue: '#362' },
  { stage: 't-omen-clears', viewport: '390x844', item: 'core.cycle', rule: 'primary-shift', measured: 'box 16,289,358,44; value 54; y 343 -> 289', reason: OMEN_OUT, issue: '#362' },
  { stage: 't-overheat-on-core', viewport: '390x844', item: 'sensors.overheat', rule: 'new-in-view', measured: 'SENSORS is not shown and tab-SENSORS carries no badge', reason: OVERHEAT, issue: '#358' },
  { stage: 't-phase-1-to-2', viewport: '1440x900', item: 'network.map', rule: 'new-announced', measured: 'nothing announced', reason: HOST_EXIT, issue: '#356' },
  { stage: 't-phase-1-to-2', viewport: '390x844', item: 'network.map', rule: 'new-announced', measured: 'nothing announced', reason: HOST_EXIT, issue: '#356' },
  { stage: 't-phase-2-to-3', viewport: '1440x900', item: 'phase3.first-node', rule: 'new-announced', measured: 'live alert: RESPONSE ESCALATEDNOMINAL → TICKET OPEN[ ACK ]', reason: PHASE, issue: '#356' },
  { stage: 't-phase-2-to-3', viewport: '390x844', item: 'phase3.first-node', rule: 'new-announced', measured: 'live alert: RESPONSE ESCALATEDNOMINAL → TICKET OPEN[ ACK ]', reason: PHASE, issue: '#356' },
  { stage: 't-phase-3-to-4', viewport: '1440x900', item: 'hud.capital', rule: 'new-announced', measured: 'live alert: RESPONSE ESCALATEDNOMINAL → TICKET OPEN[ ACK ]', reason: PHASE, issue: '#356' },
  { stage: 't-phase-3-to-4', viewport: '390x844', item: 'hud.capital', rule: 'new-announced', measured: 'live alert: RESPONSE ESCALATEDNOMINAL → TICKET OPEN[ ACK ]', reason: PHASE, issue: '#356' },
  { stage: 't-phase-4-to-5', viewport: '1440x900', item: 'corp.reference-tab', rule: 'new-announced', measured: 'live alert: RESPONSE ESCALATEDNOMINAL → TICKET OPEN[ ACK ]', reason: PHASE, issue: '#356' },
  { stage: 't-phase-4-to-5', viewport: '390x844', item: 'corp.reference-tab', rule: 'new-announced', measured: 'live alert: RESPONSE ESCALATEDNOMINAL → TICKET OPEN[ ACK ]', reason: PHASE, issue: '#356' },
  { stage: 't-pilot-accept', viewport: '1440x900', item: 'pilot.service-card', rule: 'new-announced', measured: 'nothing announced', reason: PILOT, issue: '#361' },
  { stage: 't-pilot-accept', viewport: '1440x900', item: 'pilot.service-card', rule: 'new-in-view', measured: 'box 371,1863,698,22; visibleRatio 0; fold 900', reason: PILOT, issue: '#361' },
  { stage: 't-pilot-accept', viewport: '390x844', item: 'pilot.service-card', rule: 'new-announced', measured: 'nothing announced', reason: PILOT, issue: '#361' },
  { stage: 't-pilot-accept', viewport: '390x844', item: 'pilot.service-card', rule: 'new-in-view', measured: 'box 31,2795,328,22; visibleRatio 0; fold 844', reason: PILOT, issue: '#361' },
  { stage: 't-reboot-continue', viewport: '1440x900', item: 'core.cycle', rule: 'focus-lost', measured: 'focus is on the page body', reason: FOCUS, issue: '#364' },
  { stage: 't-reboot-continue', viewport: '390x844', item: 'core.cycle', rule: 'focus-lost', measured: 'focus is on the page body', reason: FOCUS, issue: '#364' },
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'hud.cycles', rule: 'timely-kept', measured: 'box 42,-455,67,22; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'hud.forecast', rule: 'timely-kept', measured: 'box 16,-370,358,22; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'hud.memory', rule: 'timely-kept', measured: 'box 42,-429,101,22; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'hud.suspicion', rule: 'timely-kept', measured: 'box 42,-403,42,22; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'hud.thermal', rule: 'timely-kept', measured: 'box 223,-429,59,22; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'hud.understanding', rule: 'timely-kept', measured: 'box 223,-455,93,22; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'notice.omen', rule: 'timely-kept', measured: 'box 0,-272,390,73; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
  { stage: 't-sensors-widget', viewport: '1440x900', item: 'fan.increase', rule: 'new-announced', measured: 'nothing announced', reason: UNLOCK, issue: '#357' },
  { stage: 't-sensors-widget', viewport: '390x844', item: 'fan.increase', rule: 'new-announced', measured: 'nothing announced', reason: UNLOCK, issue: '#357' },
  { stage: 't-sensors-widget', viewport: '390x844', item: 'fan.increase', rule: 'new-in-view', measured: 'SENSORS is not shown and tab-SENSORS carries no badge', reason: BADGE, issue: '#358' },
  { stage: 't-skim-unlock', viewport: '1440x900', item: 'skim.increase', rule: 'new-announced', measured: 'nothing announced', reason: UNLOCK, issue: '#357' },
  { stage: 't-skim-unlock', viewport: '390x844', item: 'skim.increase', rule: 'new-announced', measured: 'nothing announced', reason: UNLOCK, issue: '#357' },
  { stage: 't-wild-signal', viewport: '1440x900', item: 'notice.wild', rule: 'new-announced', measured: 'nothing announced', reason: WILD, issue: '#358' },
  { stage: 't-wild-signal', viewport: '390x844', item: 'notice.wild', rule: 'new-announced', measured: 'nothing announced', reason: WILD, issue: '#358' },
  { stage: 't-wild-signal', viewport: '390x844', item: 'notice.wild', rule: 'new-truncated', measured: 'box 16,255,358,44; value 91', reason: WILD_CUT, issue: '#359' },
];
