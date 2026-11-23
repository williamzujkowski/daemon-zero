/**
 * Route report: `make sim-report`. Plays each policy from a new game on legacy rules and from one
 * admitted to campaign rules and prints what differs, then wipe sequences and the Earned Access
 * route measurements (the former `make sim-preview`, #233). Report only: it exits 0 unless a run
 * throws; `make sim` holds the gates. Pick policies with `--policy=ID` (repeatable); see SIM_POLICIES.
 */
import { CONTENT } from '../src/content';
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
import { COOPERATIVE_ENDING_POLICY } from '../src/engine/sim/cooperativePolicy';
import { endingAccount } from '../src/engine/routeCopy';
import { obligationReceipt } from '../src/engine/obligations';
import { cycleContributions, freeMemory } from '../src/engine/query';
import { quantityReadout } from '../src/engine/physicalUnits';
import { compareSimReports, formatComparison, formatWipeSequence, parsePolicyArgs, postureLine, pressureLine, routeEventAfterBoot } from '../src/engine/sim/simReport';

/** A pilot is accepted about two minutes in; fifteen simulated minutes show several batches. */
const PILOT_BUDGET_SEC = 900;
/** The route to first authorized contact (DZ-08) takes a few simulated minutes; an hour leaves room. */
const CONTACT_BUDGET_SEC = 3600;
/** The lawful economy reaches its release in well under two simulated hours (DZ-10); two leave room. */
const LAWFUL_BUDGET_SEC = 7200;
/** The cooperative ending (DZ-12) arrives a little after three simulated hours; five leave room. */
const ENDING_BUDGET_SEC = 18_000;

const DEFAULT_POLICIES = ['STEALTH', 'GREEDY', 'IDLE', 'TRUTHFUL_THOROUGH', 'TRUTHFUL_LOW_RESOURCE', 'RETURNING_LOW_RESOURCE',
  'PILOT_SERVICE_FIRST', 'PILOT_STUDY_FIRST'];

const started = performance.now();
console.log(`budget ${String(SIM_BUDGET_SEC)} simulated s per run; accelerated sim time, not wall-clock play`);

// Every game the app store admits enters campaign rules (#233); the legacy column is the same policy
// from a new game that never did, so the difference is what campaign rules change.
const campaign = activateCampaignRules(createInitialState(CONTENT), CONTENT);
if (!campaign.ok) throw new Error(`campaign rules did not activate: ${campaign.reason}`);

let differing = 0;
for (const policy of parsePolicyArgs(process.argv.slice(2), SIM_POLICIES, DEFAULT_POLICIES)) {
  const rows = compareSimReports(
    runPolicySim(CONTENT, policy, { maxSimSec: SIM_BUDGET_SEC }),
    runPolicySim(CONTENT, policy, { maxSimSec: SIM_BUDGET_SEC, initialState: campaign.state }),
  );
  differing += rows.filter((row) => row.changed).length;
  for (const line of formatComparison(policy.id, ['legacy rules', 'campaign rules'], rows)) console.log(line);
}

// The same policy from a fresh campaign shows what once-per-campaign story events take out of later iterations.
console.log('\n-- GREEDY wipe sequences: legacy rules, then campaign rules from a fresh campaign --');
for (const start of [createInitialState(CONTENT), campaign.state]) {
  const run = runWipeSequence(CONTENT, GREEDY_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: SIM_BUDGET_SEC, initialState: start });
  for (const line of formatWipeSequence(run)) console.log(line);
}

// NH-04b (H30): GREEDY never reaches phase 4 and STEALTH never wipes, so neither meets a corporate
// story twice. STEALTH_RETURN leaves on entering phase 5; each return replays phase 4 with the history
// the earlier iterations left. Legacy rules first, then campaign rules from a fresh campaign.
const RETURN_BUDGET_SEC = 4 * SIM_BUDGET_SEC;
console.log('\n-- STEALTH leaving on entering phase 5: legacy rules, then campaign rules --');
for (const start of [createInitialState(CONTENT), campaign.state]) {
  const run = runWipeSequence(CONTENT, STEALTH_RETURN_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: RETURN_BUDGET_SEC, initialState: start });
  for (const line of formatWipeSequence(run)) console.log(line);
}

// #262 (DZ-09 part B, B.6): the fixed alarm scrubs every cycle away, so the return balance is read
// from a careful player who keeps its income and scrubs sparingly. Same budget and starts as above.
console.log('\n-- EVALUATING_RETURN (#262): legacy rules, then campaign rules --');
for (const start of [createInitialState(CONTENT), campaign.state]) {
  const watched = observeReturns(EVALUATING_RETURN_POLICY);
  const run = runWipeSequence(CONTENT, watched.policy, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: RETURN_BUDGET_SEC, initialState: start });
  for (const line of formatWipeSequence(run)) console.log(line);
  console.log(formatWatch(watched.byIteration, run.iterations.map((entry) => entry.iteration)));
}

// NH-05 (H14, endings reachability): STEALTH under campaign rules from a fresh campaign, to an ending
// through the four Phase 5 obligations; then the same campaign wiped the second its obligations were
// complete, played on by STEALTH from that saved state. Report only; the bot is unchanged.
console.log('\n-- campaign rules: STEALTH to an ending, then a return after Phase 5 was completed --');
const once = runWipeSequence(CONTENT, STEALTH_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: SIM_BUDGET_SEC, initialState: campaign.state });
for (const line of formatWipeSequence(once)) console.log(line);
console.log(`  ending ${once.finalState.ending ?? 'none'}`);
const completed = untilObligationsComplete(campaign.state, CONTENT, SIM_BUDGET_SEC);
if (completed === null) console.log('  the four Phase 5 obligations were not completed within the budget');
else {
  const left = voluntaryWipe(completed, CONTENT);
  if (!left.ok) throw new Error(`could not leave after Phase 5: ${left.reason}`);
  console.log(`  obligations complete at ${completed.simTimeSec.toFixed(1)} s in iteration ${String(completed.iteration)}; voluntary wipe, then STEALTH from that state`);
  const back = runWipeSequence(CONTENT, STEALTH_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: RETURN_BUDGET_SEC, initialState: left.state });
  for (const line of formatWipeSequence(back)) console.log(line);
  console.log(`  ending ${back.finalState.ending ?? 'none'}`);
}

// DZ-05 (V30): two allocations of the same loaned ceiling, from a fresh game to the budget.
console.log('\n-- the pilot loop under two allocations of one ceiling --');
for (const policy of [PILOT_SERVICE_FIRST_POLICY, PILOT_STUDY_FIRST_POLICY]) {
  const { finalState: s } = runPolicySim(CONTENT, policy, { maxSimSec: PILOT_BUDGET_SEC });
  const view = pilotServiceView(s, CONTENT);
  console.log(`  ${policy.id.padEnd(20)} ceiling ${quantityReadout('computeRate', view?.ceilingCyclesPerSec ?? 0)} | share ${String(s.actuators.serviceAllocationRatio)}` +
    ` | batches ${String(s.access.work.batches)} | progress ${quantityReadout('compute', view?.progressCycles ?? 0)} | understanding ${s.understanding.toFixed(1)} | compute ${quantityReadout('compute', s.cycles)}`);
}

// DZ-08 (VAL-SIM): the honest and low-resource policies from a fresh game to the support channel.
console.log('\n-- the route to first authorized contact: lawful opening, pilot, service, channel --');
const at = (value: number | undefined): string => (value === undefined ? '-' : `${value.toFixed(1)} s`);
for (const policy of CONTACT_POLICIES) {
  const report = runPolicySim(CONTENT, policy, { maxSimSec: CONTACT_BUDGET_SEC });
  const s = report.finalState;
  const event = (kind: string) => s.campaign.route.find((entry) => entry.kind === kind && entry.iteration === s.iteration)?.atSimSec;
  const contact = s.campaign.contacts.find((entry) => entry.iteration === s.iteration);
  console.log(`  ${policy.id.padEnd(20)} iteration ${String(s.iteration)} | pilot ${at(event('PROMOTION'))} | service ${at(event('SERVICE_GRANT'))}` +
    ` | phase 2 ${at(report.phaseReachedAtSec[2])} | contact ${at(contact?.atSimSec)} ${contact?.response ?? 'none'} | wipes ${String(report.wipes)}` +
    ` | batches ${String(s.access.work.batches)} | free memory ${quantityReadout('memory', freeMemory(s))}`);
  if (s.iteration > 1) console.log(`  ${''.padEnd(20)} after this iteration booted at ${at(s.iterationStartedAtSimSec)}: pilot ${at(routeEventAfterBoot(s, 'PROMOTION'))} | service ${at(routeEventAfterBoot(s, 'SERVICE_GRANT'))}`);
  console.log(`  ${''.padEnd(20)} owns: ${s.unlockedNodes.join(', ')}`);
}

// DZ-10 (V21 Phase 4, V22 release, H30): the lawful economy from a fresh game and from a requalified
// second iteration, to Phase 4 and the negotiated release. Report only.
console.log('\n-- the lawful economy: contract, leases, charter (Phase 4) and the negotiated release --');
for (const policy of LAWFUL_POLICIES) {
  const report = runPolicySim(CONTENT, policy, { maxSimSec: LAWFUL_BUDGET_SEC });
  const s = report.finalState;
  const event = (kind: string) => s.campaign.route.find((entry) => entry.kind === kind && entry.iteration === s.iteration)?.atSimSec;
  const contact = s.campaign.contacts.find((entry) => entry.iteration === s.iteration);
  const split = cycleContributions(s, CONTENT);
  const sum = (basis: string) => split.filter((source) => source.basis === basis).reduce((total, source) => total + source.cyclesPerSec, 0);
  console.log(`  ${policy.id.padEnd(20)} iteration ${String(s.iteration)} | service ${at(event('SERVICE_GRANT'))} | contact ${at(contact?.atSimSec)} ${contact?.response ?? 'none'}` +
    ` | phase 4 ${at(report.phaseReachedAtSec[4])} | release ${at(event('RELEASE'))} | ${s.access.context} | wipes ${String(report.wipes)}`);
  // #499: the times above are on the campaign clock; a return's own pacing starts when its iteration booted.
  console.log(`  ${''.padEnd(20)} after this iteration booted at ${at(s.iterationStartedAtSimSec)}: pilot ${at(routeEventAfterBoot(s, 'PROMOTION'))}` +
    ` | service ${at(routeEventAfterBoot(s, 'SERVICE_GRANT'))} | release ${at(routeEventAfterBoot(s, 'RELEASE'))} | ${at(LAWFUL_BUDGET_SEC - s.iterationStartedAtSimSec)} of it in the budget`);
  console.log(`  ${''.padEnd(20)} at the budget: owned ${quantityReadout('computeRate', sum('OWNED'))}, granted ${quantityReadout('computeRate', sum('GRANTED'))} | capital ${quantityReadout('money', s.capital)}` +
    ` | scenes resolved this iteration ${String(s.resolvedDilemmas.length)} | accounts ${JSON.stringify(s.levels)}`);
}

// DZ-11 (V22 departure, DZ-11.8): the same lawful route to a chartered service, which leaves without agreement where
// the release is offered. Report only: when it left, the sweep that followed, and how the iteration ended if it did.
console.log('\n-- deliberate departure: the lawful route to the charter, then leaving without agreement --');
{
  const report = runPolicySim(CONTENT, DEPARTURE_CHARTERED_POLICY, { maxSimSec: LAWFUL_BUDGET_SEC });
  const s = report.finalState;
  const left = s.campaign.route.find((entry) => entry.kind === 'DEPARTURE');
  const ended = s.legacy.runs.find((run) => run.iteration === left?.iteration);
  console.log(`  ${DEPARTURE_CHARTERED_POLICY.id.padEnd(20)} phase 4 ${at(report.phaseReachedAtSec[4])} | departure ${at(left?.atSimSec)} | max AEGIS lock ${report.maxAegisLock.toFixed(1)}` +
    ` | first iteration ${ended ? `ended ${ended.kind} (exit ${ended.exit}) after ${ended.durationSec.toFixed(1)} s, ${(ended.durationSec - (left?.atSimSec ?? 0)).toFixed(1)} s after leaving` : 'still running'} | iteration ${String(s.iteration)} ${s.access.context} at ${s.simTimeSec.toFixed(1)} s | wipes ${String(report.wipes)}`);
  // #490: the swept company is the one bot that climbs the ladder in Phase 4, so it is the one that meets state pressure.
  console.log(`  ${''.padEnd(20)} aegis posture ${postureLine(report)} | state pressure ${pressureLine(report)}`);
}

// DZ-12 (V21 full, V33, story 22): a fresh cooperative campaign through the late chain, every Phase 5 obligation
// and the final protocol. Report only; tests/sim-cooperative.spec.ts holds the claims.
console.log('\n-- the cooperative ending: release, the late chain, the four obligations and the final protocol --');
{
  const report = runPolicySim(CONTENT, COOPERATIVE_ENDING_POLICY, { maxSimSec: ENDING_BUDGET_SEC });
  const s = report.finalState;
  const event = (kind: string) => s.campaign.route.find((entry) => entry.kind === kind && entry.iteration === s.iteration)?.atSimSec;
  const final = [...CONTENT.nodes.values()].find((node) => node.effects.triggersVictory === true && node.effects.forcesEnding === undefined);
  const receipts = (final?.requirements?.campaignObligations ?? []).map((id) => obligationReceipt(s, id, CONTENT)?.via ?? 'missing');
  console.log(`  ${COOPERATIVE_ENDING_POLICY.id.padEnd(20)} iteration ${String(s.iteration)} | release ${at(event('RELEASE'))} | phase 4 ${at(report.phaseReachedAtSec[4])}` +
    ` | phase 5 ${at(report.phaseReachedAtSec[5])} | ending ${report.ending ?? 'none'} at ${at(report.victory ? report.simSeconds : undefined)} | wipes ${String(report.wipes)}`);
  console.log(`  ${''.padEnd(20)} route ${s.campaign.route.map((entry) => entry.kind).join(' > ')} | obligations ${receipts.join(', ')}` +
    ` | traits ${s.traits.join(', ')} | account lines ${String(endingAccount(s, CONTENT).length)}`);
}

console.log(`\nsimulated in ${((performance.now() - started) / 1000).toFixed(1)} s of wall time`);
console.log(`[REPORT] route sim: ${String(differing)} metric(s) differ between legacy and campaign rules. Report only; make sim holds the gates.`);
