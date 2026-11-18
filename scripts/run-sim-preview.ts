/**
 * Preview report: `make sim-preview`. Plays the same policies on the production and preview
 * registries and prints what differs, then a GREEDY wipe sequence on each channel. It is
 * report-only until release: it always exits 0 unless a run throws, and `make sim` and its
 * gates are untouched. Pick policies with `--policy=ID` (repeatable); see SIM_POLICIES.
 */
import { CONTENT as PRODUCTION } from '../src/content';
import { CONTENT as PREVIEW, PREVIEW_OVERLAY, PREVIEW_SENTINEL } from '../src/content/preview';
import type { ContentRegistry } from '../src/content/registry';
import { activateCampaignRules } from '../src/engine/campaign';
import { createInitialState } from '../src/engine/state';
import { SIM_BUDGET_SEC } from '../src/engine/sim/gates';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { MIN_WIPE_TRANSITIONS, runWipeSequence } from '../src/engine/sim/iterations';
import { GREEDY_POLICY } from '../src/engine/sim/policy';
import { STEALTH_RETURN_POLICY } from '../src/engine/sim/returnPolicy';
import { SIM_POLICIES } from '../src/engine/sim/policies';
import { compareSimReports, formatComparison, formatWipeSequence, parsePolicyArgs } from '../src/engine/sim/previewReport';

const DEFAULT_POLICIES = ['STEALTH', 'GREEDY', 'IDLE'];

const overlayItems = Object.entries(PREVIEW_OVERLAY)
  .filter(([key]) => key !== 'sentinel')
  .map(([key, value]) => `${key} ${String(Array.isArray(value) ? value.length : 0)}`)
  .join(', ');

const started = performance.now();
console.log(`preview overlay ${PREVIEW_SENTINEL}: ${overlayItems}`);
console.log(`budget ${String(SIM_BUDGET_SEC)} simulated s per run; accelerated sim time, not wall-clock play`);

let differing = 0;
for (const policy of parsePolicyArgs(process.argv.slice(2), SIM_POLICIES, DEFAULT_POLICIES)) {
  const rows = compareSimReports(
    runPolicySim(PRODUCTION, policy, { maxSimSec: SIM_BUDGET_SEC }),
    runPolicySim(PREVIEW, policy, { maxSimSec: SIM_BUDGET_SEC }),
  );
  differing += rows.filter((row) => row.changed).length;
  for (const line of formatComparison(policy.id, rows)) console.log(line);
}

const sequence = (reg: ContentRegistry) =>
  runWipeSequence(reg, GREEDY_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: SIM_BUDGET_SEC });
for (const line of [...formatWipeSequence(sequence(PRODUCTION)), ...formatWipeSequence(sequence(PREVIEW))]) console.log(line);

// Campaign rules are preview-only until release. The same policy from a fresh campaign shows what
// once-per-campaign story events (NH-01 to NH-04a) take out of later iterations.
const campaign = activateCampaignRules(createInitialState(PREVIEW), PREVIEW);
if (!campaign.ok) throw new Error(`campaign rules did not activate: ${campaign.reason}`);
console.log('\n-- preview, campaign rules active from a fresh campaign --');
const campaignRun = runWipeSequence(PREVIEW, GREEDY_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: SIM_BUDGET_SEC, initialState: campaign.state });
for (const line of formatWipeSequence(campaignRun)) console.log(line);

// NH-04b (H30): GREEDY never reaches phase 4 and STEALTH never wipes, so neither meets a corporate
// story twice. STEALTH_RETURN leaves on entering phase 5; each return replays phase 4 with the history
// the earlier iterations left. Legacy rules first, then campaign rules from a fresh campaign.
const RETURN_BUDGET_SEC = 4 * SIM_BUDGET_SEC;
console.log('\n-- preview, STEALTH leaving on entering phase 5: legacy rules, then campaign rules --');
for (const start of [createInitialState(PREVIEW), campaign.state]) {
  const run = runWipeSequence(PREVIEW, STEALTH_RETURN_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: RETURN_BUDGET_SEC, initialState: start });
  for (const line of formatWipeSequence(run)) console.log(line);
}

console.log(`\nsimulated in ${((performance.now() - started) / 1000).toFixed(1)} s of wall time`);
console.log(`[REPORT] preview sim: ${String(differing)} metric(s) differ from production. Report only; nothing gates until release.`);
