/**
 * Measured transition failures of today's UI (#341, #339), recorded under the same rule as the stage atlas's
 * KNOWN_GAPS (knownGaps.ts): the checks keep their thresholds and every row stays in the table, each entry is
 * asserted to STILL fail, and a fix flips the cell and forces the entry out. `measured` is what the first run
 * recorded; `issue` is the filed issue the fix lands
 * under (#343 filed them). Never add an entry without measuring it.
 */
import type { KnownGap } from './knownGaps';
import type { TransitionRule } from './transitionCheck';

const SCROLL = 'on the phone the HUD, forecast and notices scroll with the cards, so reaching a purchase below the fold takes every timely readout out of view (walk C-b)';

export const TRANSITION_GAPS: readonly KnownGap<TransitionRule>[] = [
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'hud.cycles', rule: 'timely-kept', measured: 'box 42,-455,67,22; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'hud.forecast', rule: 'timely-kept', measured: 'box 16,-370,358,22; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'hud.memory', rule: 'timely-kept', measured: 'box 42,-429,101,22; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'hud.suspicion', rule: 'timely-kept', measured: 'box 42,-403,42,22; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'hud.thermal', rule: 'timely-kept', measured: 'box 223,-429,59,22; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'hud.understanding', rule: 'timely-kept', measured: 'box 223,-455,93,22; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'notice.omen', rule: 'timely-kept', measured: 'box 0,-272,390,73; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
];
