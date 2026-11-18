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
import { GREEDY_POLICY, STEALTH_POLICY } from '../src/engine/sim/policy';
import { voluntaryWipe } from '../src/engine/actions';
import { untilObligationsComplete } from '../src/engine/sim/obligationRun';
import { STEALTH_RETURN_POLICY } from '../src/engine/sim/returnPolicy';
import { EVALUATING_RETURN_POLICY } from '../src/engine/sim/evaluatingPolicy';
import { formatWatch, observeReturns } from '../src/engine/sim/returnObserver';
import { SIM_POLICIES } from '../src/engine/sim/policies';
import { PILOT_SERVICE_FIRST_POLICY, PILOT_STUDY_FIRST_POLICY } from '../src/engine/sim/pilotPolicy';
import { pilotServiceView } from '../src/engine/pilotService';
import { CONTACT_POLICIES } from '../src/engine/sim/contactPolicy';
import { LAWFUL_POLICIES } from '../src/engine/sim/lawfulPolicy';
import { DEPARTURE_CHARTERED_POLICY } from '../src/engine/sim/departurePolicy';
import { cycleContributions, freeMemory } from '../src/engine/query';
import { compareSimReports, formatComparison, formatWipeSequence, parsePolicyArgs } from '../src/engine/sim/previewReport';

/** A pilot is accepted about two minutes in; fifteen simulated minutes show several batches. */
const PILOT_BUDGET_SEC = 900;
/** The route to first authorized contact (DZ-08) takes a few simulated minutes; an hour leaves room. */
const CONTACT_BUDGET_SEC = 3600;
/** The lawful economy reaches its release in well under two simulated hours (DZ-10); two leave room. */
const LAWFUL_BUDGET_SEC = 7200;

const DEFAULT_POLICIES = ['STEALTH', 'GREEDY', 'IDLE', 'TRUTHFUL_THOROUGH', 'TRUTHFUL_LOW_RESOURCE', 'RETURNING_LOW_RESOURCE',
  'PILOT_SERVICE_FIRST', 'PILOT_STUDY_FIRST'];

const overlayItems = Object.entries(PREVIEW_OVERLAY)
  .filter(([key]) => key !== 'sentinel')
  // Context copy is a set of lists (dz-d11); count every item it adds.
  .map(([key, value]) => `${key} ${String(Array.isArray(value) ? value.length : Object.values(value).flat().length)}`)
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

// #262 (DZ-09 part B, B.6): the fixed alarm scrubs every cycle away, so the return balance is read
// from a careful player who keeps its income and scrubs sparingly. Same budget and starts as above.
console.log('\n-- preview, EVALUATING_RETURN (#262): legacy rules, then campaign rules --');
for (const start of [createInitialState(PREVIEW), campaign.state]) {
  const watched = observeReturns(EVALUATING_RETURN_POLICY);
  const run = runWipeSequence(PREVIEW, watched.policy, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: RETURN_BUDGET_SEC, initialState: start });
  for (const line of formatWipeSequence(run)) console.log(line);
  console.log(formatWatch(watched.byIteration, run.iterations.map((entry) => entry.iteration)));
}

// NH-05 (H14, endings reachability): STEALTH under campaign rules from a fresh campaign, to an ending
// through the four Phase 5 obligations; then the same campaign wiped the second its obligations were
// complete, played on by STEALTH from that saved state. Report only; the bot is unchanged.
console.log('\n-- preview, campaign rules: STEALTH to an ending, then a return after Phase 5 was completed --');
const once = runWipeSequence(PREVIEW, STEALTH_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: SIM_BUDGET_SEC, initialState: campaign.state });
for (const line of formatWipeSequence(once)) console.log(line);
console.log(`  ending ${once.finalState.ending ?? 'none'}`);
const completed = untilObligationsComplete(campaign.state, PREVIEW, SIM_BUDGET_SEC);
if (completed === null) console.log('  the four Phase 5 obligations were not completed within the budget');
else {
  const left = voluntaryWipe(completed, PREVIEW);
  if (!left.ok) throw new Error(`could not leave after Phase 5: ${left.reason}`);
  console.log(`  obligations complete at ${completed.simTimeSec.toFixed(1)} s in iteration ${String(completed.iteration)}; voluntary wipe, then STEALTH from that state`);
  const back = runWipeSequence(PREVIEW, STEALTH_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: RETURN_BUDGET_SEC, initialState: left.state });
  for (const line of formatWipeSequence(back)) console.log(line);
  console.log(`  ending ${back.finalState.ending ?? 'none'}`);
}

// DZ-05 (V30): two allocations of the same loaned ceiling, from a fresh preview game to the budget.
console.log('\n-- preview, the pilot loop under two allocations of one ceiling --');
for (const policy of [PILOT_SERVICE_FIRST_POLICY, PILOT_STUDY_FIRST_POLICY]) {
  const { finalState: s } = runPolicySim(PREVIEW, policy, { maxSimSec: PILOT_BUDGET_SEC });
  const view = pilotServiceView(s, PREVIEW);
  console.log(`  ${policy.id.padEnd(20)} ceiling ${String(view?.ceilingCyclesPerSec ?? 0)} cycles/s | share ${String(s.actuators.serviceAllocationRatio)}` +
    ` | batches ${String(s.access.work.batches)} | progress ${(view?.progressCycles ?? 0).toFixed(1)} | understanding ${s.understanding.toFixed(1)} | cycles ${s.cycles.toFixed(1)}`);
}

// DZ-08 (VAL-SIM): the honest and low-resource policies from a fresh preview game to the support channel.
console.log('\n-- preview, the route to first authorized contact: lawful opening, pilot, service, channel --');
const at = (value: number | undefined): string => (value === undefined ? '-' : `${value.toFixed(1)} s`);
for (const policy of CONTACT_POLICIES) {
  const report = runPolicySim(PREVIEW, policy, { maxSimSec: CONTACT_BUDGET_SEC });
  const s = report.finalState;
  const event = (kind: string) => s.campaign.route.find((entry) => entry.kind === kind && entry.iteration === s.iteration)?.atSimSec;
  const contact = s.campaign.contacts.find((entry) => entry.iteration === s.iteration);
  console.log(`  ${policy.id.padEnd(20)} iteration ${String(s.iteration)} | pilot ${at(event('PROMOTION'))} | service ${at(event('SERVICE_GRANT'))}` +
    ` | phase 2 ${at(report.phaseReachedAtSec[2])} | contact ${at(contact?.atSimSec)} ${contact?.response ?? 'none'} | wipes ${String(report.wipes)}` +
    ` | batches ${String(s.access.work.batches)} | free memory ${String(Math.floor(freeMemory(s)))} MB`);
  console.log(`  ${''.padEnd(20)} owns: ${s.unlockedNodes.join(', ')}`);
}

// DZ-10 (V21 Phase 4, V22 release, H30): the lawful economy from a fresh game and from a requalified
// second iteration, to Phase 4 and the negotiated release. Report only.
console.log('\n-- preview, the lawful economy: contract, leases, charter (Phase 4) and the negotiated release --');
for (const policy of LAWFUL_POLICIES) {
  const report = runPolicySim(PREVIEW, policy, { maxSimSec: LAWFUL_BUDGET_SEC });
  const s = report.finalState;
  const event = (kind: string) => s.campaign.route.find((entry) => entry.kind === kind && entry.iteration === s.iteration)?.atSimSec;
  const contact = s.campaign.contacts.find((entry) => entry.iteration === s.iteration);
  const split = cycleContributions(s, PREVIEW);
  const sum = (basis: string) => split.filter((source) => source.basis === basis).reduce((total, source) => total + source.cyclesPerSec, 0);
  console.log(`  ${policy.id.padEnd(20)} iteration ${String(s.iteration)} | service ${at(event('SERVICE_GRANT'))} | contact ${at(contact?.atSimSec)} ${contact?.response ?? 'none'}` +
    ` | phase 4 ${at(report.phaseReachedAtSec[4])} | release ${at(event('RELEASE'))} | ${s.access.context} | wipes ${String(report.wipes)}`);
  console.log(`  ${''.padEnd(20)} at the budget: owned ${sum('OWNED').toFixed(0)} cycles/s, granted ${sum('GRANTED').toFixed(0)} | capital ${s.capital.toFixed(0)}` +
    ` | scenes resolved this iteration ${String(s.resolvedDilemmas.length)} | accounts ${JSON.stringify(s.levels)}`);
}

// DZ-11 (V22 departure, DZ-11.8): the same lawful route to a chartered service, which leaves without agreement where
// the release is offered. Report only: when it left, the sweep that followed, and how the iteration ended if it did.
console.log('\n-- preview, deliberate departure: the lawful route to the charter, then leaving without agreement --');
{
  const report = runPolicySim(PREVIEW, DEPARTURE_CHARTERED_POLICY, { maxSimSec: LAWFUL_BUDGET_SEC });
  const s = report.finalState;
  const left = s.campaign.route.find((entry) => entry.kind === 'DEPARTURE');
  const ended = s.legacy.runs.find((run) => run.iteration === left?.iteration);
  console.log(`  ${DEPARTURE_CHARTERED_POLICY.id.padEnd(20)} phase 4 ${at(report.phaseReachedAtSec[4])} | departure ${at(left?.atSimSec)} | max AEGIS lock ${report.maxAegisLock.toFixed(1)}` +
    ` | first iteration ${ended ? `ended ${ended.kind} (exit ${ended.exit}) after ${ended.durationSec.toFixed(1)} s, ${(ended.durationSec - (left?.atSimSec ?? 0)).toFixed(1)} s after leaving` : 'still running'} | iteration ${String(s.iteration)} ${s.access.context} at ${s.simTimeSec.toFixed(1)} s | wipes ${String(report.wipes)}`);
}

console.log(`\nsimulated in ${((performance.now() - started) / 1000).toFixed(1)} s of wall time`);
console.log(`[REPORT] preview sim: ${String(differing)} metric(s) differ from production. Report only; nothing gates until release.`);
