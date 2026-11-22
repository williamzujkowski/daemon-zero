/**
 * Measured transition failures of today's UI (#341, #339), recorded under the same rule as the stage atlas's
 * KNOWN_GAPS (knownGaps.ts): the checks keep their thresholds and every row stays in the table, each entry is
 * asserted to STILL fail, and a fix flips the cell and forces the entry out. `measured` is what the first run
 * recorded; `issue` is the filed issue the fix lands
 * under (#343 filed them). Never add an entry without measuring it.
 */
import type { KnownGap } from './knownGaps';
import type { TransitionRule } from './transitionCheck';

/** The HUD and the forecast now pin (vote-1795328874247-003j4kk, then the tier in vote-1795335412078-ubcj3e7); the omen stays
 *  under EXECUTE in CORE by vote-1795219347137-c21nx42, spoken by the announcer and marked on the CORE tab, and this gap is
 *  accepted by vote-1795335412078-ubcj3e7 (7 of 7), which closed #365. */
const SCROLL = 'accepted (vote-1795335412078-ubcj3e7): on the phone the omen stays in CORE under EXECUTE and scrolls with the cards, spoken by the announcer and marked on the CORE tab (walk C-b)';

export const TRANSITION_GAPS: readonly KnownGap<TransitionRule>[] = [
  { stage: 't-scroll-to-buy', viewport: '390x844', item: 'notice.omen', rule: 'timely-kept', measured: 'box 0,-272,390,73; visibleRatio 0; fold 799', reason: SCROLL, issue: '#365' },
];
