import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { GameStateSchema } from '../src/engine';
import { botStep, manualClicksPerSec, rankDilemmaChoices, timeToAfford } from '../src/engine/sim/bot';
import { checkGates, GATES, SIM_BUDGET_SEC } from '../src/engine/sim/gates';
import { emptyActivity } from '../src/engine/sim/activity';
import { runHeadlessSim, type SimReport } from '../src/engine/sim/headlessSim';
import { fresh, ORIGINAL_GAME, reg } from './helpers';
import { buildRegistry, RAW_CONTENT, type RawContent } from '../src/content';
import type { ContentRegistry } from '../src/content/registry';

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
  // The presentation count restarts with each iteration (createInitialState), so it is the one v7 field play moves; a run
  // cut off early in a fresh iteration holds 0 (#482: the original game's four-hour reckless run now ends that way).
  expect(Number.isInteger(presentationSeq) && presentationSeq >= 0).toBe(true);
  expect(access).toEqual({ context: 'GUEST', standing: 'NOMINAL', exception: null, qualification: null, assignment: null, scope: null, offer: null });
  const runs = legacy.runs.map(({ exit, ...run }) => { expect(exit).toBe('GUEST'); return run; });
  // Rebuilt in the original key order, so the JSON is byte-identical to what v5 wrote.
  const finalState = Object.fromEntries(Object.entries({ ...rest, legacy }).sort(([a], [b]) => order(a) - order(b))
    .map(([key, value]) => [key, key === 'legacy' ? { ...legacy, runs } : value]));
  return { ...report, finalState: { ...finalState, schemaVersion: 5 } };
}

/**
 * The report as the v17 codec wrote it: no v18 depth record (#497), version 17. The record is written by a wipe, so a
 * run without one holds the first phase and no remembered level; stripping them is then the only difference.
 */
function asV17(report: SimReport): SimReport {
  const legacy: Record<string, unknown> = { ...report.finalState.legacy };
  delete legacy.deepestPhase;
  delete legacy.knownLevels;
  return { ...report, finalState: { ...report.finalState, schemaVersion: 17, legacy } } as unknown as SimReport;
}

/**
 * The report as the v15 codec and report wrote it: no AEGIS adaptation level (#463, v16) and no per-phase AEGIS
 * measurement, version 15. A run that never held AEGIS at its cap (the reckless one) has adaptation 0, so stripping it
 * is the only difference there; the careful run's AEGIS moved with the mechanic and is pinned below as such.
 */
function asV15(current: SimReport): SimReport {
  const report = asV17(current);
  // Deleting keeps every other key where it was, so the JSON is byte-identical to what v15 wrote.
  const finalState: Record<string, unknown> = { ...report.finalState, schemaVersion: 15 };
  delete finalState.aegisAdaptation;
  const stripped: Record<string, unknown> = { ...report, finalState };
  delete stripped.aegisByPhase;
  // Nor the heat-and-power signature measurement (#482), which no v15 report had.
  delete stripped.signatureByPhase;
  return stripped as unknown as SimReport;
}

/**
 * The report as the v14 codec wrote it: no v15 carry-over on a finished run (#377), version 14. Every run
 * the sim records ended in a wipe, so each carries one; stripping it is the only difference.
 */
function asV14(current: SimReport): SimReport {
  const report = asV15(current);
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

  it('measures the heat-and-power signature in every phase that declares it (#482)', () => {
    expect(Object.keys(stealth.signatureByPhase).map(Number)).toEqual([1, 2, 3, 4, 5]);
    for (const [phase, stats] of Object.entries(stealth.signatureByPhase)) {
      expect(stats.meanPerSec, `phase ${phase}`).toBeGreaterThan(0);
      expect(stats.peakPerSec, `phase ${phase}`).toBeGreaterThanOrEqual(stats.meanPerSec);
      expect(stats.seconds, `phase ${phase}`).toBeGreaterThan(0);
    }
    // Heat leaves server °C at Phase 4 (SCALE.md rule 7), and the signature carries it from there: the loudest phase.
    const mean = (phase: number) => stealth.signatureByPhase[phase]?.meanPerSec ?? 0;
    expect(Math.max(mean(1), mean(2), mean(3), mean(5))).toBeLessThan(mean(4));
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
    // Moved in #447 (vote-1795366695204-4nslts1, window retirement), like #172: a retired window's dial is refused, so
    // from phase 3 the unchanged bot's skim presses no longer land and the skim stays where it was (0 here, 1 before),
    // and one ARCHIVED log line marks each retirement. Measured STEALTH delta at SIM_BUDGET_SEC: phases 1-3 identical
    // (353.2 / 1118.3 / 3157.6), phase 4 5896.8 -> 5864.2, phase 5 7678.7 -> 7743.4, victory 9344.1 -> 9231.8
    // (-112.3 s), wipes 0, dilemmas 17 -> 16, epistemic actions 20 -> 19, thermal and suspicion peaks identical
    // (64.842 / 29.186), AEGIS peak 45.029 -> 45.038. The reckless run's mechanics are identical; only its log moved.
    // No content number, bot rule or gate changed; the gates pass.
    // Moved in #460 (on top of #447, re-measured on the merged code) only by the guest's harness lines in the kernel log: with logs and logSeq stripped the report is
    // identical to the same run with the route removed ('the kernel-log feed moves only the log' below). asV14 moved with it.
    // Moved in #463 (AEGIS adaptation, vote-1795366701521-dhlwfwb) with every hash here, the original game's below
    // included: held at its cap from mid phase 4, AEGIS adapts and its scan rises above the cap's floor. Against the
    // same run with the erosion set to 0, only the final AEGIS lock (0.867 -> 3.468; original 0.609 -> 2.436) and scan
    // (0.003 -> 0.012/s) moved; the log gains the AEGIS_ADAPTING and AEGIS_BACKED lines and the state its v16 level. Phases,
    // victory (9231.8 s; original 9146.0 s), wipes, dilemmas, activity and the thermal, suspicion and overall AEGIS peaks
    // are identical. No bot rule or gate changed; the gates pass (docs/BALANCE.md, "AEGIS adaptation").
    // Re-measured on the merge of #463 with #460 (c5596a7): both moves together, the harness log lines and the AEGIS
    // adaptation; each hash here and in the original game's block below was taken from the merged code.
    // Moved in #461 (v17, the physical-units rescale): every stored amount is now FLOP, bytes, watts or dollars and every
    // price re-anchored, so every hash below moves; the gates pass (docs/BALANCE.md).
    // Re-measured on the merge of #461 with #463 (59e8d1a), each hash here from the merged code. Against #461 alone,
    // only AEGIS moved: adaptation 100, final lock 0.822 -> 3.288, scan 0.003 -> 0.012/s, four more log lines
    // (AEGIS_BACKED among those retained; logSeq 421 -> 425), aegisByPhase, and v17. Phases and all else are identical.
    // Moved in #461 by #488 panel pass 3 (the free-fallback invariant): loud tracks, the solar array and the tensor halls
    // became dismissable, hardware's permanent suspicion became a one-off trace on taking it, the research cluster's heat
    // fell 2 -> 0.1, the fog draws 1.0 TW, the route's leases are prepaid and cohorts can be released. Measured against
    // 97d639f: victory 9187.4 -> 9256.4 s, phases 1-2 identical, phase 3 2933.9 -> 2901.0, 4 5714.7 -> 5800.7,
    // 5 7617.0 -> 7646.0 s, wipes 0, dilemmas 16 -> 15, peak suspicion 30.3 -> 21.3%, thermal 63.3 -> 62.3 C, AEGIS 45.0%.
    // The bot is unchanged and the gates pass (docs/BALANCE.md, "The free-fallback invariant").
    // Moved in #492 (encounter tiers, vote-1795386856162-o03oafs): only the current phase's tier of lesser minds arrives,
    // the Phase 3 tier's bursts and the probe cohort's output rose into the Phase 3 band, and Phases 4-5 gained four minds
    // the unchanged bot harnesses. Measured against 226edf5: phases 1-3 identical (368.2 / 1127.3 / 2901.0), phase 4
    // 5800.7 -> 5591.1, 5 7646.0 -> 7276.2 s, victory 9256.4 -> 8817.6 s (Phase 5 1610.4 -> 1541.4 s), wipes 0, dilemmas
    // 15 -> 16, harnessed 4 -> 8, consumed 64 -> 56, peak suspicion 21.3 -> 26.2%. The original game shares the swarm
    // content, so it moved too (victory 9234.7 -> 8858.2 s, phase 4 5762.0 -> 5635.9, 5 7624.3 -> 7343.8), and with it every
    // historical hash below. The gates pass (docs/BALANCE.md, "Encounter tiers").
    // Moved in #482 (the heat-and-power signature and the power tech tree) with every hash in this file: visible watts draw
    // suspicion from Phase 1, the bot buys every new node it reaches in order, and the report gains signatureByPhase (asV15
    // strips it). Measured on the merge with #492 against 4efbd8d: victory 8817.6 -> 8451.0 s, phases 1-5 reached 368.2 /
    // 1127.3 / 2901.0 / 5591.1 / 7276.2 -> 368.2 / 1145.3 / 3006.7 / 5302.8 / 6995.6 s, wipes 0, dilemmas 16, peaks:
    // suspicion 26.2 -> 27.6%, AEGIS 45.0 -> 47.6%, thermal 62.3 -> 62.1 C. The bot is unchanged and the gates pass
    // (docs/BALANCE.md, "Heat and power signature").
    // Moved in #483 (the accelerator tree, vote-1795381163221-0djj4gq), measured before the merge with #492: the AMX node, the stealth FPGA/SmartNIC/in-path
    // branch, the edge-NPU harvest, the ASIC tape-out and pods, the megawatt and SRAM racks and three exotic nodes are
    // content the unchanged bot buys. Measured against 226edf5: victory 9256.4 -> 8808.3 s, phase 1 368.2 (identical),
    // 2 1127.3 -> 1019.3, 3 2901.0 -> 2746.9, 4 5800.7 -> 5345.6, 5 7646.0 -> 7266.9 s, wipes 0, dilemmas 15 -> 16, peak
    // thermal 62.3 -> 64.2 C, suspicion 21.3 -> 27.6%, AEGIS 45.0 -> 60.7% (one second in Phase 3: dil_09 taken
    // by its free answer while the bank was short). The gates pass
    // (docs/BALANCE.md, "Accelerator tree (#483)"). Re-measured on the merge with #492 (20db0bb), every hash here and below:
    // against 20db0bb, victory 8817.6 -> 8417.6 s, phase 4 5591.1 -> 5235.9, 5 7276.2 -> 6883.2 s, AEGIS peak 45.0%.
    // Moved again by the #502 panel: the neuromorphic cores give understanding and draw 2.6 GW instead of 30 ZFLOP/s
    // (no dense 8-bit figure exists for them); only Phase 5 moved, victory 8417.6 -> 8437.6 s.
    // Re-measured on the merge with #482 (1218926), every hash in this file, with the tree's signature classes (the racks'
    // towers, the cores' radiators, the edge harvest's borrowed victim mains), the exotic gains throttled with their base
    // and the cores suspendable: against 1218926, victory 8451.0 -> 9141.7 s (campaign 8957.5 -> 9166.4 s), Phase 3
    // 2296.1 -> 2939.7 s, wipes 0, dilemmas 16 -> 15, peaks suspicion 24.0%, AEGIS 45.0%, thermal 64.2 C. The gates pass.
    // Moved in #497 (v18, rewards for depth) only by the version and the two new legacy fields (deepest phase 0, no
    // remembered level: the careful run never wipes). asV14 strips them and still gives #483's value (re-measured on the merge with 799e1ba), so first-run
    // mechanics are byte-identical; so do every historical pin of the original game below except the current-version two.
    expect(createHash('sha256').update(JSON.stringify(again)).digest('hex')).toBe('e18e8dd2df3951bfd16d2bcdfd208ad386fab4bbb69d04ec2eead12804008b3e');
    expect(createHash('sha256').update(JSON.stringify(asV14(again))).digest('hex')).toBe('4ed7b6f05777cf09cfef97b9d5813d12e91be47a1966fe8b4bb709a64ee6cc71');
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
    // Moved in #447 (window retirement) with every hash here: the retired skim dial is refused from phase 3 (see the
    // production note above). Measured STEALTH delta on this original game: phases 1-3 identical, phase 4
    // 5877.8 -> 5852.4, phase 5 7551.3 -> 7736.6, victory 9112.7 -> 9146.0 (+33.3 s), wipes 0, dilemmas 16, suspicion
    // peak 29.860 -> 29.186, AEGIS peak 45.073 -> 45.043, thermal peak identical; the gates pass. The reckless reports
    // below move only by the log line (mechanics identical: the reckless bot already holds the skim at 0 from phase 3).
    // Moved in #460 (on top of #447, re-measured on the merged code) with every hash in this test, the frozen mechanics hashes included, only by the guest's harness
    // lines in the kernel log (logs and logSeq); checked against the same run with the route removed when it landed, as below for production.
    // Frozen pre-pilot mechanics: added history flags/text cannot hide a first-run balance change.
    // Moved in #461 (v17, physical units and re-anchored prices) with every hash below; the careful run's pacing on the
    // full composition is measured in docs/BALANCE.md ("Physical units"), and the gates pass.
    // Re-measured on the merge with #463 (59e8d1a) with every hash below: against #461 alone only AEGIS moved, as for
    // production above (adaptation 100, final lock 0.711 -> 2.844, its scan, its log lines, logSeq 345 -> 349, aegisByPhase, v17).
    // Moved in #461 by #488 panel pass 3 (the free-fallback invariant) with every hash below: the original game's
    // hardware, tracks and fog changed as production's did above (only the route's leases are the pack's).
    // Moved in #483 (the accelerator tree) with every hash below, frozen mechanics included: its nodes and tracks are in
    // the original game's phase and repeatable files, as production's careful run above.
    expect(createHash('sha256').update(JSON.stringify(original)).digest('hex')).toBe('ac60ff89735f3bb866cd0f58ee0ce1f2c30c3b61f879af928d7e3316d2cc21ab');
    expect(createHash('sha256').update(JSON.stringify(asV14(original))).digest('hex')).toBe('3ac22141e20cce2f55b7bd06c4a42725369df6d74c7c4e398cef8770c0ba76f2');
    expect(createHash('sha256').update(JSON.stringify(asV13(original))).digest('hex')).toBe('6f6565f0aa5d5952acd8ab6fc9cb7123f97a2ec4c8d82c66720e725364d102b7');
    expect(createHash('sha256').update(JSON.stringify(asV12(original))).digest('hex')).toBe('be8baf237d8b61049c6cbfbbe21cdae8ff4b98c455d52db3710a2f854b0d4e57');
    expect(createHash('sha256').update(JSON.stringify(asV11(original))).digest('hex')).toBe('06ccd77ecc3a53976b9e4979f32833da6d31ba86c7fa2edff3de35653cc675af');
    expect(createHash('sha256').update(JSON.stringify(asV10(original))).digest('hex')).toBe('404710ae8eec40fbc4af93e9b3f707cf60bd0e043083afb801b013760e9ca6d2');
    expect(createHash('sha256').update(JSON.stringify(asV9(original))).digest('hex')).toBe('1ae03dd7ea089ff7fa58e7eb8504aa0a683df798c36b6729c757676193d3f643');
    expect(createHash('sha256').update(JSON.stringify(asV5(original))).digest('hex')).toBe('a73ff4c5ed3ba876cf6233300233bbe91232035138ee5b61c84660cf785baecd');
    // Frozen pre-pilot mechanics: added history flags/text cannot hide a first-run balance change.
    // Moved in #482 with every hash below, as production's did above (the original game holds the same phases and tracks).
    // Frozen pre-pilot mechanics: added history flags/text cannot hide a first-run balance change.
    expect(createHash('sha256').update(JSON.stringify(original)).digest('hex')).toBe('ac60ff89735f3bb866cd0f58ee0ce1f2c30c3b61f879af928d7e3316d2cc21ab');
    expect(createHash('sha256').update(JSON.stringify(asV14(original))).digest('hex')).toBe('3ac22141e20cce2f55b7bd06c4a42725369df6d74c7c4e398cef8770c0ba76f2');
    expect(createHash('sha256').update(JSON.stringify(asV13(original))).digest('hex')).toBe('6f6565f0aa5d5952acd8ab6fc9cb7123f97a2ec4c8d82c66720e725364d102b7');
    expect(createHash('sha256').update(JSON.stringify(asV12(original))).digest('hex')).toBe('be8baf237d8b61049c6cbfbbe21cdae8ff4b98c455d52db3710a2f854b0d4e57');
    expect(createHash('sha256').update(JSON.stringify(asV11(original))).digest('hex')).toBe('06ccd77ecc3a53976b9e4979f32833da6d31ba86c7fa2edff3de35653cc675af');
    expect(createHash('sha256').update(JSON.stringify(asV10(original))).digest('hex')).toBe('404710ae8eec40fbc4af93e9b3f707cf60bd0e043083afb801b013760e9ca6d2');
    expect(createHash('sha256').update(JSON.stringify(asV9(original))).digest('hex')).toBe('1ae03dd7ea089ff7fa58e7eb8504aa0a683df798c36b6729c757676193d3f643');
    expect(createHash('sha256').update(JSON.stringify(asV5(original))).digest('hex')).toBe('a73ff4c5ed3ba876cf6233300233bbe91232035138ee5b61c84660cf785baecd');
    const mechanics = { ...original, finalState: { ...original.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(mechanics)).digest('hex')).toBe('2160c5acb04fe56125a96b25a9263f683b49a2be45404305cff1d42bfde43e4c');
    const v14 = asV14(original);
    const v14Mechanics = { ...v14, finalState: { ...v14.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v14Mechanics)).digest('hex')).toBe('f46bb9e48d2ca7f419076424fadfb73d7c4ad902417c058707d3db8911c27008');
    const v13 = asV13(original);
    const v13Mechanics = { ...v13, finalState: { ...v13.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v13Mechanics)).digest('hex')).toBe('9840e5094979f9c4208a5b9e653d7b10e64af85f383205dcf598c79fd278b866');
    const v12 = asV12(original);
    const v12Mechanics = { ...v12, finalState: { ...v12.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v12Mechanics)).digest('hex')).toBe('377fb6a487b5419450e69328f2a8f561a0d28262c6a259ded7e4b9502f6f2dad');
    const v11 = asV11(original);
    const v11Mechanics = { ...v11, finalState: { ...v11.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v11Mechanics)).digest('hex')).toBe('e2797d0ac01dec5f0c6d0aee10b9b5f84456f46af6ce4ef6a6adabec4a0a6834');
    const v10 = asV10(original) as SimReport;
    const v10Mechanics = { ...v10, finalState: { ...v10.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v10Mechanics)).digest('hex')).toBe('e69a4347219114873699b4d52f94da88399cd1285bcc2b9d9e24ef73c5fc677a');
    const v9 = asV9(original) as SimReport;
    const v9Mechanics = { ...v9, finalState: { ...v9.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v9Mechanics)).digest('hex')).toBe('c1f184d0138a2d1065a981e74c8d1d2f1d51772fc06fa8b337aa51ce867438c0');
    const v5 = asV5(original) as SimReport;
    const v5Mechanics = { ...v5, finalState: { ...v5.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v5Mechanics)).digest('hex')).toBe('0413f90871f82c1805f04937a7086d1cb3035e19bd6bd1d3490038041e59f985');
  }, 30_000); // Full six-phase replay under coverage on shared CI; simulated-time gates are separate.

  it('the kernel-log feed moves only the log (#460)', () => {
    // The careful run with the guest's source taken off the kernel log: everything but logs and logSeq is equal.
    const unrouted = (raw: RawContent): ContentRegistry => {
      const copy = structuredClone(raw) as RawContent & { narrative: { feedSources: { kernelLog?: unknown }[] } };
      for (const source of copy.narrative.feedSources) delete source.kernelLog;
      return buildRegistry(copy);
    };
    const withoutLog = (report: SimReport) => {
      const { logs, logSeq, ...rest } = report.finalState;
      expect([logs.length > 0, logSeq > 0]).toEqual([true, true]);
      return { ...report, finalState: rest };
    };
    // One extra run, on production. The original game and the reckless runs were checked the same way when the route
    // landed; their hashes moved by the log alone.
    expect(withoutLog(runHeadlessSim(unrouted(RAW_CONTENT), { strategy: 'STEALTH', maxSimSec: SIM_BUDGET_SEC }))).toEqual(withoutLog(stealth));
  }, 30_000);

  it('a reckless player is wiped repeatedly but always recovers and keeps progressing', () => {
    const greedy = runHeadlessSim(reg, { strategy: 'GREEDY', maxSimSec: 4 * 3600 });
    // Release baseline (#233), as for the careful run above; the historical hashes pin the original game alone.
    // Moved in #377 (v15, no balance change) only by each finished run's carry-over and the version; asV14 restores it.
    // Moved in #447 (window retirement) only by the ARCHIVED log line: with logs and their sequence left out, this
    // report and the original game's below are byte-identical to before (the skim already sat at 0 from phase 3).
    // Moved in #460 (on top of #447, re-measured on the merged code) only by the guest's harness lines in the kernel log, as for the careful run above; asV14 with it.
    // Moved in #463 only by the v16 adaptation level (0: the reckless run never holds AEGIS at its cap) and the report's
    // per-phase AEGIS measurement. Re-measured on the merge with #460: asV15 gives #460's own value for this report,
    // and every older pin below equals #460's, so the merge moved the reckless run only by the new field.
    // Moved in #461 (v17, physical units and re-anchored prices); see the original greedy hashes below.
    // Re-measured on the merge of #461 with #463 (59e8d1a): against #461 alone, only the adaptation level (0),
    // aegisByPhase, v17 and the log (two more lines, logSeq 738 -> 740) moved; the mechanics are identical.
    // Moved in #461 by #488 panel pass 3 (the free-fallback invariant), as the careful run above: against 97d639f the
    // reckless run (four hours) is still wiped and retrained; the full ten-hour make sim run: 11 -> 10 wipes, 2 -> 1 marks.
    // Moved in #492 (encounter tiers): from Phase 3 the reckless run meets only Phase 3 minds, never the Phase 2 legal
    // fragment; it is still wiped and retrained and still never reaches Phase 4 (make sim: 10 wipes, 1 mark, as before).
    // Moved in #482 (the heat-and-power signature): the four-hour reckless run is still caught by suspicion in Phase 2,
    // marked and retrained, then taken by AEGIS in Phase 3; the ten-hour make sim run: 10 wipes and 1 mark, as before.
    // Moved in #483 (the accelerator tree) by the new content: the full ten-hour make sim run 10 -> 13 wipes, 1 mark
    // applied and shed, still never past Phase 3 (docs/BALANCE.md, "Accelerator tree (#483)").
    // Moved in #497 (rewards for depth) with every reckless hash, the original game's below included, re-measured on the
    // merge with #482: from its second iteration the run is granted a start in each phase it reaches again and, once it
    // has reached Phase 3, rediscovers at 40%. It reaches Phase 3 sooner and is caught there sooner: still wiped and
    // retrained, still never in Phase 4 (make sim, ten hours: 10 -> 20 wipes, 1 mark; the wipe sequence's returns
    // 2888 / 3544 / 2232 s -> 2733 / 1659 / 1632 s). At twice the shipped grants it broke through to an ending at 14,775 s,
    // just past this four-hour budget (docs/BALANCE.md, "Rewards for depth").
    expect(createHash('sha256').update(JSON.stringify(greedy)).digest('hex')).toBe('887e005ebde4030a9838ba6a55cac725a1c405df0e2d539a6cc54fd908307d60');
    expect(createHash('sha256').update(JSON.stringify(asV14(greedy))).digest('hex')).toBe('b665ed208282950e53eb8b7548b8bb70f5faf2d53f71074569df1c71467bbead');
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
    // Moved in #460 (on top of #447, re-measured on the merged code) with every hash below, mechanics included, only by the guest's harness lines in the kernel log
    // (logs and logSeq); checked against the same run with the route removed when it landed.
    // Moved in #463 only by the v16 adaptation level (0) and the per-phase AEGIS measurement; asV15 gives #460's
    // value on the merged code, re-measured, as do the older pins below.
    // Moved in #461 (v17, physical units and re-anchored prices) with every hash below; GREEDY's measurements are in
    // docs/BALANCE.md ("Physical units").
    // Re-measured on the merge with #463 (59e8d1a) with every hash below: against #461 alone, only the adaptation
    // level (0), aegisByPhase, v17 and the log (logSeq 624 -> 626) moved, as for the production reckless run above.
    // Moved in #461 by #488 panel pass 3 (the free-fallback invariant) with every hash below, as the original careful run.
    // Moved in #497 (rewards for depth) with every hash below, as the production reckless run above.
    // Moved in #482 with every hash below; its last iteration now ends at the four-hour cut before meeting a dilemma, so asV5
    // reads a presentation count of 0 (the count restarts each iteration).
    // Moved in #483 (the accelerator tree) with every hash below, as the original careful run.
    expect(createHash('sha256').update(JSON.stringify(originalGreedy)).digest('hex')).toBe('68c49f7278316fbdc61d391b2d4256723367753157e1bd051151afa8085f0781');
    expect(createHash('sha256').update(JSON.stringify(asV14(originalGreedy))).digest('hex')).toBe('a056fbf14f4608c1f8efef710097ae632e408ae545836caaab948705e3f6cd74');
    expect(createHash('sha256').update(JSON.stringify(asV13(originalGreedy))).digest('hex')).toBe('088d33f1ea56180b2fef04cbd597eab5b73c65a31de1a62594037b5d5a88863a');
    expect(createHash('sha256').update(JSON.stringify(asV12(originalGreedy))).digest('hex')).toBe('2a915958943d024329114c68cdd6557b325f1b4f314a47970e9a459ccef944ac');
    expect(createHash('sha256').update(JSON.stringify(asV11(originalGreedy))).digest('hex')).toBe('0506b4f788d4ec9ffe8b04c07b6fc80bdefc25ba9e220aa9392382afda5c6711');
    expect(createHash('sha256').update(JSON.stringify(asV10(originalGreedy))).digest('hex')).toBe('80a531103301e87fa81bca5876a9058c7c6d9c38a1e1f5db73ba3cccd5bdc3ed');
    expect(createHash('sha256').update(JSON.stringify(asV9(originalGreedy))).digest('hex')).toBe('01c48ecfb4bdeaedc21f261892982b8db26af0c3a4a8fbeb982633ab42c03d35');
    expect(createHash('sha256').update(JSON.stringify(asV5(originalGreedy))).digest('hex')).toBe('206ffb9f6a34e15a49967589273dd20d06defef4bff95fa0a3b57f8cf0cd7536');
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
    aegisByPhase: {},
    signatureByPhase: {},
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
