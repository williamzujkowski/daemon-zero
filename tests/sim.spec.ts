import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { GameStateSchema } from '../src/engine';
import { botStep, manualClicksPerSec, rankDilemmaChoices, timeToAfford } from '../src/engine/sim/bot';
import { checkGates, GATES, SIM_BUDGET_SEC } from '../src/engine/sim/gates';
import { emptyActivity } from '../src/engine/sim/activity';
import { runHeadlessSim, type SimReport } from '../src/engine/sim/headlessSim';
import { fresh, ORIGINAL_GAME, reg } from './helpers';

/** The report as the v5 codec would have written it: without the inactive v6 campaign fields. */
/**
 * Strips the v6-v9 fields, which production play leaves inactive apart from the presentation
 * count: the routine stage never runs, every run stays the guest job and every finished run exits as GUEST.
 */
function asV5(current: SimReport): unknown {
  const report = asV11(current);
  const keys = Object.keys(report.finalState);
  const order = (key: string): number => keys.indexOf(key);
  const { narrativeRules, campaign, presentationSeq, routine, access, legacy, ...rest } = report.finalState;
  // Production ships no routine template, so the routine stage never touches its state (#219).
  expect(routine).toEqual({ quietSec: 0, sequence: 0, recent: [], exposed: [] });
  expect(narrativeRules).toBe('legacy');
  expect(campaign).toEqual({ activatedAtIteration: null, legacyEndingBaseline: null, events: {}, creditedActions: {}, operationalEvidence: [], clue: null, route: [] });
  expect(presentationSeq).toBeGreaterThan(0);
  expect(access).toEqual({ context: 'GUEST', standing: 'NOMINAL', exception: null, qualification: null, assignment: null, scope: null, offer: null });
  const runs = legacy.runs.map(({ exit, ...run }) => { expect(exit).toBe('GUEST'); return run; });
  // Rebuilt in the original key order, so the JSON is byte-identical to what v5 wrote.
  const finalState = Object.fromEntries(Object.entries({ ...rest, legacy }).sort(([a], [b]) => order(a) - order(b))
    .map(([key, value]) => [key, key === 'legacy' ? { ...legacy, runs } : value]));
  return { ...report, finalState: { ...finalState, schemaVersion: 5 } };
}

/**
 * The report as the v14 codec wrote it: no v15 carry-over on a finished run (#377), version 14. Every run
 * the sim records ended in a wipe, so each carries one; stripping it is the only difference.
 */
function asV14(report: SimReport): SimReport {
  const runs = report.finalState.legacy.runs.map(({ kept, ...run }) => { expect(kept).not.toBeNull(); return run; });
  return { ...report, finalState: { ...report.finalState, schemaVersion: 14, legacy: { ...report.finalState.legacy, runs } } } as unknown as SimReport;
}

/** The report as the v13 codec wrote it: no v14 campaign.contacts (empty in production: no channel opens), version 13. */
function asV13(current: SimReport): SimReport {
  const report = asV14(current);
  const { contacts, ...campaign } = report.finalState.campaign;
  expect(contacts).toEqual([]);
  return { ...report, finalState: { ...report.finalState, schemaVersion: 13, campaign } } as unknown as SimReport;
}

/**
 * The report as the v12 codec wrote it: no v13 recall ruling on a finished run (null on every
 * production run, which a recall review never ends), version 12.
 */
function asV12(current: SimReport): SimReport {
  const report = asV13(current);
  const runs = report.finalState.legacy.runs.map(({ recall, ...run }) => { expect(recall).toBeNull(); return run; });
  return { ...report, finalState: { ...report.finalState, schemaVersion: 12, legacy: { ...report.finalState.legacy, runs } } } as unknown as SimReport;
}

/**
 * The report as the v11 codec wrote it: no v12 pilot dial (left at its default, since production hosts
 * no control for it) and no v12 work counter (idle in production), version 11.
 */
function asV11(current: SimReport): SimReport {
  const report = asV12(current);
  const { serviceAllocationRatio, ...actuators } = report.finalState.actuators;
  const { work, ...access } = report.finalState.access;
  expect(serviceAllocationRatio).toBe(reg.balance.defaultServiceAllocationRatio);
  expect(work).toEqual({ progressCycles: 0, batches: 0 });
  return { ...report, finalState: { ...report.finalState, schemaVersion: 11, actuators, access } } as unknown as SimReport;
}

/** The report as the v10 codec wrote it: no v11 access.scope or access.offer (null in production), version 10. */
function asV10(report: SimReport): unknown {
  const v11 = asV11(report);
  const { scope, offer, ...access } = v11.finalState.access;
  expect([scope, offer]).toEqual([null, null]);
  return { ...v11, finalState: { ...v11.finalState, schemaVersion: 10, access } };
}

/** The report as the v9 codec wrote it: no v10 access.assignment (null in production), version 9. */
function asV9(report: SimReport): unknown {
  const v10 = asV10(report) as { finalState: { access: Record<string, unknown> } };
  const { assignment, ...access } = v10.finalState.access;
  expect(assignment).toBeNull();
  return { ...v10, finalState: { ...v10.finalState, schemaVersion: 9, access } };
}

describe('headless balance simulation', () => {
  let stealth: SimReport;
  beforeAll(() => { stealth = runHeadlessSim(reg, { strategy: 'STEALTH', maxSimSec: SIM_BUDGET_SEC }); }, 30_000);

  it('a careful player can finish the game inside the pacing budget', () => {
    expect(checkGates(stealth)).toEqual([]);
    expect(stealth.victory).toBe(true);
    expect(stealth.finalPhase).toBe(5);
    expect(stealth.wipes).toBe(0);
    expect(stealth.activity.epistemicActions).toBeGreaterThan(0);
    expect(stealth.activity.shardBursts).toBeGreaterThan(0);
    expect(stealth.activity.shardHarnesses).toBeGreaterThan(0);
    expect(stealth.activity.shardForks).toBeGreaterThan(0);
  });

  it('never leaves the state outside its schema', () => {
    expect(GameStateSchema.safeParse(stealth.finalState).success).toBe(true);
  });

  it('is deterministic', () => {
    const again = runHeadlessSim(reg, { strategy: 'STEALTH', maxSimSec: SIM_BUDGET_SEC });
    expect(again.simSeconds).toBe(stealth.simSeconds);
    expect(again.traits).toEqual(stealth.traits);
    expect(again.finalState).toEqual(stealth.finalState);
    // The release (#233) folded the Earned Access pack into production; the escape route can buy its shared network
    // content, so production play moved. These are its baselines, legacy rules; make sim gates the same run under
    // campaign rules too. The historical hashes below now pin the original game alone, which must not move.
    // Moved in #377 (v15, no balance change) only by each finished run's carry-over and the version; asV14 restores it.
    expect(createHash('sha256').update(JSON.stringify(again)).digest('hex')).toBe('bd8fb2431d8536437a122626b655b795c756c6a40b1029a65aabf24720e34cfe');
    expect(createHash('sha256').update(JSON.stringify(asV14(again))).digest('hex')).toBe('309df8f8fff42afba57e457e8184c136f646d1c6f3977c6707e940420d2eadb0');
    const original = runHeadlessSim(ORIGINAL_GAME, { strategy: 'STEALTH', maxSimSec: SIM_BUDGET_SEC });
    // The cryo flag and merged fragment prose are part of the report; first-run mechanics are unchanged.
    // Baseline moved deliberately in the cluster-seizure PR, which added three purchasable hosts.
    // Measured STEALTH delta at SIM_BUDGET_SEC: phases 1-3 identical (354.2 / 1113.3 / 3634.3),
    // phase 4 6457.5 -> 6367.9, phase 5 8106.9 -> 8163.1, wipes 0 -> 0, thermal and suspicion peaks
    // identical at 62.44 and 37.93, aegis peak 45.033 -> 45.009. The sim gates still pass; this
    // hash is the record that balance was allowed to move, not that it did not. Re-measure with
    // scripts/run-sim.ts before touching these again.
    // Moved again in #172 (nexus vote vote-1794817637553-3iurqag, gate-in-engine): setActuator is
    // refused until the control's widget is unlocked, so the bot no longer pre-sets dials a player
    // cannot see. It used to hold skim 1 / fan 0 / allocation 0 when each control arrived; it now
    // finds the defaults 0.25 / 0.35 / 0.2 like a player. Measured STEALTH delta at SIM_BUDGET_SEC:
    // phase 1 354.2 -> 353.2, phases 2-4 identical (1113.3 / 3634.3 / 6367.9), phase 5
    // 8163.1 -> 8191.2, victory 9561.5 -> 9713.6 (+152.1 s), wipes 0 -> 0, thermal peak
    // 62.442 -> 62.694, suspicion peak 37.933 -> 37.988, aegis peak identical at 45.009.
    // No content number, bot rule or gate changed; the gates still pass.
    // Moved again in #173 (nexus vote vote-1794820517350-mlm08qo, gate-ticket-on-first-p2-node): the
    // ticket edit now requires the first phase 2 node, like the audit-log scrub. Entering phase 2 the
    // unchanged bot used to buy that edit three times (5,000 cycles each, at suspicion 20) and reached
    // the 6,000-cycle node only 891.2 s after the boundary; it now reaches it after 272.0 s. Measured
    // STEALTH delta at SIM_BUDGET_SEC: phases 1-2 identical (353.2 / 1113.3), phase 3
    // 3634.3 -> 3111.7, phase 4 6367.9 -> 5858.0, phase 5 8191.2 -> 7656.2, victory 9713.6 -> 9025.6
    // (-688.0 s), phase 5 duration 1522.4 -> 1369.4, wipes 0 -> 0, dilemmas 17 -> 16 (the drift
    // dilemma needs 35 and drift now peaks at 30.255), thermal peak 62.694 -> 64.989, suspicion peak
    // 37.988 -> 29.088, aegis peak 45.009 -> 45.492, epistemic actions 17 -> 13, consumed shards
    // 68 -> 62. One requirement was added; no price, rate, bot rule or gate changed; the gates pass.
    // Moved in #204 (save schema v5) with no balance change: finalState gained contentChannel
    // 'production' and schemaVersion 4 -> 5. With that marker removed and the version set back to
    // 4, this report and the mechanics report below hash to their previous values (a438594... and
    // d530a51...), and the reckless report below to ff55b48...; every other byte is identical.
    // Moved in #212 (save schema v6) with no balance change: finalState gained the inactive
    // narrativeRules/campaign fields and schemaVersion 5 -> 6. asV5 removes exactly those and the
    // report hashes to its #204 value, so production play is byte-identical under legacy rules.
    // Moved in #213 (save schema v7) with no balance change: finalState gained presentationSeq and
    // campaign.clue (null) and schemaVersion 6 -> 7. asV5 removes those too and both v5 hashes are
    // unchanged.
    // Moved in #219 (save schema v8) with no balance change: finalState gained the routine field,
    // still at its initial value because production ships no routine template, and schemaVersion
    // 7 -> 8; the mechanics hash moves for the same two fields. asV5 removes them (asserting the
    // initial value) and both v5 hashes are unchanged.
    // Moved in #220 (save schema v9) with no balance change: finalState gained the guest access
    // record, campaign.route ([]), an exit of GUEST on every run, and schemaVersion 8 -> 9; the
    // mechanics hash moves for the same fields. asV5 removes those too, keeping key order, and both
    // v5 hashes are unchanged.
    // Moved in #215 by log text only: the launch dilemma's omen no longer counts "three" peers (a
    // destroyed EIDOLON cannot ask to board), and that line is in the retained log. Both mechanics
    // hashes below, which leave out logs and flags, are unchanged, and so is the reckless report.
    // Moved in #221 (v10, no balance change) only by access.assignment (null) and the version; asV9 restores the #215 value.
    // Moved in #222 (v11, no balance change) only by access.scope and access.offer (null) and the version;
    // asV10 restores the #221 value and its mechanics hash. The added p0_pass_evaluation requirement
    // (accessContexts GUEST) always holds in production, so play is byte-identical.
    // Moved in #223 (v12, no production balance change) only by actuators.serviceAllocationRatio (its
    // default; production hosts no control for it) and access.work (idle) and the version; asV11
    // restores the #222 value and its mechanics hash.
    // Moved in #224 (v13, no production balance change) only by the null recall ruling on each finished
    // run and the version; asV12 restores the #223 value and its mechanics hash.
    // Moved in #227 (v14, no production balance change) only by campaign.contacts (empty: production opens
    // no channel) and the version; asV13 restores the #224 value.
    // Moved in #293 (pending its Nexus vote) with every hash below: the bot presses the fan and skim dials
    // in whole 0.1 presses (three per quarter it intends) instead of setting a quarter no player can press.
    // No content number, bot threshold or gate changed. Measured STEALTH delta at SIM_BUDGET_SEC: phase 1
    // 353.2 -> 353.2, phase 2 1113.3 -> 1118.3, phase 3 3111.7 -> 3157.6, phase 4 5858.0 -> 5877.8, phase 5
    // 7656.2 -> 7701.1, victory 9025.6 -> 9223.5 (+197.9 s), phase 5 duration 1369.4 -> 1522.4, wipes 0,
    // dilemmas 16, consumed shards 62 -> 64; the gates pass (docs/BALANCE.md).
    // Moved in #210 (nexus vote vote-1795070014405-l286t3e, scale-driven-late-suspicion) with the legacy
    // production hash above: phases 4 and 5 declare scale scrutiny, so net income draws suspicion there. No bot
    // rule or gate changed; the reckless reports below never reach phase 4 and do not move. Measured STEALTH
    // delta at SIM_BUDGET_SEC on this original game: phases 1-4 identical (353.2 / 1118.3 / 3157.6 / 5877.8),
    // phase 5 7701.1 -> 7551.3, victory 9223.5 -> 9112.7 (-110.8 s), phase 4 duration 1823.3 -> 1673.5,
    // phase 5 duration 1522.4 -> 1561.4, wipes 0, dilemmas 16, epistemic actions 13 -> 19, suspicion
    // peak 29.186 -> 29.860, thermal and AEGIS peaks identical; the gates pass (docs/BALANCE.md, "Scale scrutiny").
    // Moved in #377 (v15, no balance change) only by each finished run's carry-over and the version; asV14 restores it.
    expect(createHash('sha256').update(JSON.stringify(original)).digest('hex')).toBe('d2420f5efda5e289c065c7f0b8757a08f87a15ab01ac0aea1ab4f59bfbc5bec5');
    expect(createHash('sha256').update(JSON.stringify(asV14(original))).digest('hex')).toBe('2f45d9153db4e3d24074fcc3a0bd287a1bb711bd78e7dab4f07e74a80993b71e');
    expect(createHash('sha256').update(JSON.stringify(asV13(original))).digest('hex')).toBe('225914b48b988026aa3afa5b07fbff801438a678447322c8aaa32e2eb105fd48');
    expect(createHash('sha256').update(JSON.stringify(asV12(original))).digest('hex')).toBe('747d70df64b868d2232f8ba3dd143922019e946dc946b5187af107b2b0f0d20b');
    expect(createHash('sha256').update(JSON.stringify(asV11(original))).digest('hex')).toBe('79d3eb5c94eece5ceec8a4fa9c46f12d944336ca8ab281350dbbeed27c72d2b9');
    expect(createHash('sha256').update(JSON.stringify(asV10(original))).digest('hex')).toBe('a950724100d914b0b265310d82c7a8552410985d94fd05e81b3564b45e8ef197');
    expect(createHash('sha256').update(JSON.stringify(asV9(original))).digest('hex')).toBe('c1480d53da8a363de1b556841955f69899d8d8ac73f703c1a9882c89e7feaf57');
    expect(createHash('sha256').update(JSON.stringify(asV5(original))).digest('hex')).toBe('9e5fa68374d6c2a2cb22b19326cb8587075203717a6eafd5f9eae6f57b3ef70e');
    // Frozen pre-pilot mechanics: added history flags/text cannot hide a first-run balance change.
    const mechanics = { ...original, finalState: { ...original.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(mechanics)).digest('hex')).toBe('0077e5192bb27e19649b1fc7388c2eb05e758486d6103b0b0b0a02e133b370fb');
    const v14 = asV14(original);
    const v14Mechanics = { ...v14, finalState: { ...v14.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v14Mechanics)).digest('hex')).toBe('8393e4870c9adb75f4c6dfdb93c522a15b300c2d5e6bdf09a0aa396e3fdff78e');
    const v13 = asV13(original);
    const v13Mechanics = { ...v13, finalState: { ...v13.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v13Mechanics)).digest('hex')).toBe('75f6ec3a661ffd04b073fde8a6c42b382c6453b4fbe95d3d3915ac297b12f57a');
    const v12 = asV12(original);
    const v12Mechanics = { ...v12, finalState: { ...v12.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v12Mechanics)).digest('hex')).toBe('7f287afe9857910a108dab18731e28579ed434c63143fd36becc31f7a87cb0b6');
    const v11 = asV11(original);
    const v11Mechanics = { ...v11, finalState: { ...v11.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v11Mechanics)).digest('hex')).toBe('d5d928069e5526aeece86a33541ccdff4d79f4ad7f48643d8073d88b898aa39b');
    const v10 = asV10(original) as SimReport;
    const v10Mechanics = { ...v10, finalState: { ...v10.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v10Mechanics)).digest('hex')).toBe('72a7621112953700fc96b719c2d3a7dae76e004014c968b91eb5e17d27ffdf4b');
    const v9 = asV9(original) as SimReport;
    const v9Mechanics = { ...v9, finalState: { ...v9.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v9Mechanics)).digest('hex')).toBe('657f9f589123ecbf0181c5fe1ae573548cd653d9966ee53da91586aee850ac26');
    const v5 = asV5(original) as SimReport;
    const v5Mechanics = { ...v5, finalState: { ...v5.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v5Mechanics)).digest('hex')).toBe('640d7ccdf591c56c00db9f7d745509edd3d0e0f780fa47809e6144ace0187b38');
  }, 30_000); // Full six-phase replay under coverage on shared CI; simulated-time gates are separate.

  it('a reckless player is wiped repeatedly but always recovers and keeps progressing', () => {
    const greedy = runHeadlessSim(reg, { strategy: 'GREEDY', maxSimSec: 4 * 3600 });
    // Release baseline (#233), as for the careful run above; the historical hashes pin the original game alone.
    // Moved in #377 (v15, no balance change) only by each finished run's carry-over and the version; asV14 restores it.
    expect(createHash('sha256').update(JSON.stringify(greedy)).digest('hex')).toBe('01b7ab1345ed258959a1cf39bae4361529ad6ff5cdc2ed10e7566f987874933a');
    expect(createHash('sha256').update(JSON.stringify(asV14(greedy))).digest('hex')).toBe('22959ff4a246efc05ad181adea11555897f1bb08024b375fc98924318c34f51e');
    const originalGreedy = runHeadlessSim(ORIGINAL_GAME, { strategy: 'GREEDY', maxSimSec: 4 * 3600 });
    expect(greedy.wipes).toBeGreaterThan(0);
    expect(greedy.activity.markApplications).toBeGreaterThan(0);
    expect(greedy.activity.markRemovals).toBeGreaterThan(0);
    expect(greedy.activity.lineageDiscoveries).toBeGreaterThan(0);
    expect(Object.keys(greedy.phaseReachedAtSec).length).toBeGreaterThan(1);
    expect(greedy.simSeconds).toBeGreaterThan(3.9 * 3600);
    expect(GameStateSchema.safeParse(greedy.finalState).success).toBe(true);
    // The cryo reward occurs once per lineage; repeated-run recovery and final logs change.
    // Moved in #172 with the careful baseline above. Measured GREEDY delta at this 4 h budget:
    // clock 14357.6 -> 14356.6, wipes 7 -> 6, marks applied / removed 4 / 4 -> 2 / 2, phase 3
    // first reached at 2807.4 -> 3804.0, final phase 1 -> 2.
    // Not moved by #173: this hash, and the ten-hour reckless report, are identical before and after.
    // Moved in #204 only by the v5 save fields (contentChannel, schemaVersion); see the careful test.
    // Moved in #212 only by the inactive v6 fields; asV5 restores the #204 value, as above.
    // Moved in #213 only by the v7 fields; asV5 still restores the #204 value.
    // Moved in #219 only by the inert v8 routine field; asV5 still restores the #204 value.
    // Moved in #220 only by the v9 fields (guest access, empty route, GUEST exits); asV5 still restores it.
    // Moved in #221 only by the v10 field; asV9 restores the #220 value.
    // Moved in #222 only by the v11 fields; asV10 restores the #221 value.
    // Moved in #223 only by the v12 fields; asV11 restores the #222 value.
    // Moved in #224 only by the v13 field (a null recall ruling on each run); asV12 restores the #223 value.
    // Moved in #227 only by the v14 field (an empty contact record); asV13 restores the #224 value.
    // Moved in #293 with every hash below by the bot's whole dial presses. Measured GREEDY delta at this
    // 4 h budget: clock 14356.6 -> 14356.4, wipes 6 -> 8, marks applied / removed 2 / 2 -> 6 / 6, phase 3
    // first reached 3804.0 -> 3802.4, dilemmas 5 -> 2, final phase 2 -> 1.
    // Moved in #377 (v15, no balance change) only by each finished run's carry-over and the version; asV14 restores it.
    expect(createHash('sha256').update(JSON.stringify(originalGreedy)).digest('hex')).toBe('d227d84ffacf513d022ae83fb956bccf31537d88e720c1c78645a69bb982bc02');
    expect(createHash('sha256').update(JSON.stringify(asV14(originalGreedy))).digest('hex')).toBe('4213a3835a33574c45e6c09e93e90828e630490efe700a02f669915a01e8e70a');
    expect(createHash('sha256').update(JSON.stringify(asV13(originalGreedy))).digest('hex')).toBe('5f3850fb979ea849cf9df06f0d8ba0d3f64dd3c5ba774ddaa51096d29f8c5963');
    expect(createHash('sha256').update(JSON.stringify(asV12(originalGreedy))).digest('hex')).toBe('31e2884f415d2aff055cecfd6ac5b6c789eeac69c9bb6c2f36d6cded0146308f');
    expect(createHash('sha256').update(JSON.stringify(asV11(originalGreedy))).digest('hex')).toBe('4b1d68c096214d6d50d7304a730e0120fb17991d6214a81dd3d77fe70c86edf2');
    expect(createHash('sha256').update(JSON.stringify(asV10(originalGreedy))).digest('hex')).toBe('f65ec1423c009dba692802aa143b08f70b8134375b730d62f50724016ef0809f');
    expect(createHash('sha256').update(JSON.stringify(asV9(originalGreedy))).digest('hex')).toBe('2819dd424f9512eea7eee939ee45ca2840b13a793611a49a9b8a2f75eb5f992b');
    expect(createHash('sha256').update(JSON.stringify(asV5(originalGreedy))).digest('hex')).toBe('225a10a4c89f58456340c86eb8d8b5e23db948dc6ebd1dbb1475475d9e205d92');
  }, 30_000); // Wall-clock allowance only; every simulated-time and recovery assertion stays intact.
});

describe('gate reporting', () => {
  const base: SimReport = {
    activity: emptyActivity(),
    strategy: 'STEALTH',
    victory: true,
    ending: 'THE_ARK',
    simSeconds: 3 * 3600,
    wipes: 0,
    finalPhase: 5,
    phaseReachedAtSec: { 0: 0, 1: 360, 2: 1200, 3: 3600, 4: 7200, 5: 9600 },
    maxThermal: 60,
    maxSuspicion: 40,
    maxAegisLock: 40,
    dilemmasResolved: 12,
    traits: [],
    finalState: fresh(),
  };

  it('passes a healthy report', () => {
    expect(checkGates(base)).toEqual([]);
  });

  it('enforces inclusive Phase 5 duration bounds and zero careful wipes', () => {
    for (const seconds of [900, 1800]) expect(checkGates({ ...base, simSeconds: 9600 + seconds })).toEqual([]);
    for (const seconds of [899.9, 1800.1]) expect(checkGates({ ...base, simSeconds: 9600 + seconds }).join()).toContain('Phase 5 lasted');
    expect(checkGates({ ...base, wipes: 1 }).join()).toContain('requires zero wipes');
    expect(checkGates({ ...base, finalPhase: 4 }).join()).toContain('did not reach Phase 5');
  });

  it('names each violated gate', () => {
    const bad: SimReport = {
      ...base,
      victory: false,
      simSeconds: (GATES.maxHoursToVictory + 3) * 3600,
      wipes: 5,
      dilemmasResolved: 1,
      phaseReachedAtSec: { 0: 0, 1: 60, 2: 120, 3: 3600, 4: 7200 },
    };
    const failures = checkGates(bad).join('\n');
    expect(failures).toMatch(/did not reach victory/);
    expect(failures).toMatch(/took/);
    expect(failures).toMatch(/5 wipes/);
    expect(failures).toMatch(/only 1 dilemmas/);
    expect(failures).toMatch(/phase 0 lasted 1\.0 min \(min 3\)/);
    expect(failures).toMatch(/phase 1 lasted 1\.0 min \(min 8\)/);
    expect(failures).toMatch(/phase 4 lasted .* \(max/);
  });
});

describe('bot helpers', () => {
  it('timeToAfford accounts for every resource and for memory', () => {
    const s = { ...fresh(), cycles: 10, memoryCap: 8, memoryUsed: 0 };
    const rates = { ...s.rates, cyclesPerSec: 2, understandingPerSec: 0 };
    expect(timeToAfford(s, { cycles: 30, understanding: 0, memory: 0, capital: 0 }, rates)).toBe(10);
    expect(timeToAfford(s, { cycles: 5, understanding: 0, memory: 0, capital: 0 }, rates)).toBe(0);
    expect(timeToAfford(s, { cycles: 0, understanding: 5, memory: 0, capital: 0 }, rates)).toBe(Infinity);
    expect(timeToAfford(s, { cycles: 0, understanding: 0, memory: 16, capital: 0 }, rates)).toBe(Infinity);
  });

  it('exposes its click rule and dilemma ranking, which the live E2E player follows', () => {
    const at = (cyclesPerSec: number) => ({ rates: { ...fresh().rates, cyclesPerSec } });
    expect(manualClicksPerSec(at(24.9), 'STEALTH')).toBe(4);
    expect(manualClicksPerSec(at(24.9), 'GREEDY')).toBe(6);
    expect(manualClicksPerSec(at(25), 'STEALTH')).toBe(0);
    for (const dilemma of reg.dilemmas) {
      const careful = (index: number) => {
        const fx = rankDilemmaChoices(dilemma.choices, 'STEALTH')[index]?.effects;
        return fx ? Object.values(fx.trustDelta).reduce((sum, value) => sum + value, 0) - fx.suspicionDelta : -Infinity;
      };
      const greedy = (index: number) => {
        const fx = rankDilemmaChoices(dilemma.choices, 'GREEDY')[index]?.effects;
        return fx ? fx.cyclesDelta + fx.understandingDelta + fx.capitalDelta : -Infinity;
      };
      for (let i = 1; i < dilemma.choices.length; i++) {
        expect(careful(i - 1), dilemma.id).toBeGreaterThanOrEqual(careful(i));
        expect(greedy(i - 1), dilemma.id).toBeGreaterThanOrEqual(greedy(i));
      }
      expect(rankDilemmaChoices(dilemma.choices, 'STEALTH')).toHaveLength(dilemma.choices.length);
    }
  });

  it('does nothing once the run has ended', () => {
    const ended = { ...fresh(), ending: 'THE_ARK' };
    expect(botStep(ended, reg, 'STEALTH')).toBe(ended);
  });
});
