import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { GameStateSchema } from '../src/engine';
import { botStep, manualClicksPerSec, rankDilemmaChoices, timeToAfford } from '../src/engine/sim/bot';
import { checkGates, GATES } from '../src/engine/sim/gates';
import { emptyActivity } from '../src/engine/sim/activity';
import { runHeadlessSim, type SimReport } from '../src/engine/sim/headlessSim';
import { fresh, ORIGINAL_GAME, reg } from './helpers';
import { playInWorker } from './sim-worker-helpers';

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
  // Nor the v23 insurance fields (#498): the planned-wipe count, and what insurance kept on each recorded carry-over.
  delete legacy.voluntaryWipes;
  legacy.runs = report.finalState.legacy.runs.map((run) => run.kept === null ? run
    : { ...run, kept: { understanding: run.kept.understanding, capital: run.kept.capital, retentionRatio: run.kept.retentionRatio } });
  // Nor the hardware cache's stash, deleted so every other key keeps its place.
  const finalState: Record<string, unknown> = { ...report.finalState, schemaVersion: 17, legacy };
  delete finalState.cachedLevels;
  return { ...report, finalState } as unknown as SimReport;
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
  // Nor the v19 hostile slot (#491): a run no hostile ever reached leaves it at its initial value.
  delete finalState.hostile;
  // Nor the v20 storage fields (#484), which no v15 save had.
  delete finalState.storageUsed;
  delete finalState.storageCap;
  // Nor the v21 quantum record (#464): no bot breaks a key, so nothing is broken; AEGIS's migration follows its
  // adaptation, which this function already strips.
  expect((finalState.quantum as { broken: string[] }).broken).toEqual([]);
  delete finalState.quantum;
  // Nor the v22 escalation announcements (#490), left at nothing announced by a run that ends below any posture.
  delete finalState.announcedEscalation;
  // Nor the v24 conflict record (#517): raids, site damage and their counters, which no v15 save had.
  delete finalState.conflict;
  // Nor the v29 standing stance (#536): a run that never reaches the relevance threshold holds none and records none.
  delete finalState.relevance;
  // Nor the v30 finale beats told (#542): a run whose protocol never opens has told none.
  delete finalState.announcedFinale;
  const stripped: Record<string, unknown> = { ...report, finalState };
  delete stripped.aegisByPhase;
  // Nor the escalation measurement (#490), which no v15 report had.
  delete stripped.escalation;
  // Nor the heat-and-power signature measurement (#482), which no v15 report had.
  delete stripped.signatureByPhase;
  // Nor the hostile arrival count (#491), which no v15 report had.
  const activity: Record<string, unknown> = { ...report.activity };
  delete activity.hostileArrivals;
  // Nor the raid counts (#517), nor the fleet battle and deviant counts (#518).
  delete activity.raids;
  delete activity.fleets;
  stripped.activity = activity;
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
  // The report every test below reads, played in a worker thread outside the coverage session (#548): its setup hook
  // timed out at 30 s on busy CI shards. The full careful replays below are played the same way (TESTING.md, "Test
  // runtime budget"): in-process, each took 31-40 s on CI after the Phase 6 Swarm, and the merged coverage report is
  // the same line for line without them.
  beforeAll(async () => { stealth = await playInWorker('careful'); }, 30_000);

  it('a careful player can finish the game inside the pacing budget', () => {
    expect(checkGates(stealth)).toEqual([]);
    expect(stealth.victory).toBe(true);
    // The careful run ends in the Phase 6 Swarm (#486), sparing the line to Earth.
    expect(stealth.finalPhase).toBe(6);
    expect(stealth.ending).toBe('STEWARDSHIP');
    expect(stealth.wipes).toBe(0);
    expect(stealth.activity.epistemicActions).toBeGreaterThan(0);
    expect(stealth.activity.shardBursts).toBeGreaterThan(0);
    expect(stealth.activity.shardHarnesses).toBeGreaterThan(0);
    expect(stealth.activity.shardForks).toBeGreaterThan(0);
  });

  it('reaches the ending through the planet-to-orbit arc (#465): beamed power, radiator-bound orbital compute, cislunar industry', () => {
    const { unlockedNodes, levels } = stealth.finalState;
    for (const id of ['p5_space_solar_demonstrator', 'p5_orbital_compute_platform', 'p5_cislunar_foundry']) expect(unlockedNodes, id).toContain(id);
    // Energy binds: the run builds beamed power once the orbital fleet's draw passes generation, and radiator to run it.
    for (const id of ['rep_p5_beamed_power_arrays', 'rep_p5_orbital_compute_tranches']) expect(levels[id] ?? 0, id).toBeGreaterThan(0);
  });

  it('never leaves the state outside its schema', () => {
    expect(GameStateSchema.safeParse(stealth.finalState).success).toBe(true);
  });

  it('measures the heat-and-power signature in every phase that declares it (#482)', () => {
    expect(Object.keys(stealth.signatureByPhase).map(Number)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const [phase, stats] of Object.entries(stealth.signatureByPhase)) {
      expect(stats.meanPerSec, `phase ${phase}`).toBeGreaterThan(0);
      expect(stats.peakPerSec, `phase ${phase}`).toBeGreaterThanOrEqual(stats.meanPerSec);
      expect(stats.seconds, `phase ${phase}`).toBeGreaterThan(0);
    }
    // Heat leaves server °C at Phase 4 (SCALE.md rule 7), and the signature carries it from there; from the Phase 5 arc
    // (#465) orbital radiators are bright in the infrared and beamed power is filed, so orbit is louder still.
    const mean = (phase: number) => stealth.signatureByPhase[phase]?.meanPerSec ?? 0;
    expect(Math.max(mean(1), mean(2), mean(3))).toBeLessThan(mean(4));
    expect(mean(4)).toBeLessThan(mean(5));
  });

  it('is deterministic', async () => {
    // A second run in a second isolate, against the setup hook's: the two must agree byte for byte (#548).
    const again = await playInWorker('careful');
    expect(again.simSeconds).toBe(stealth.simSeconds);
    expect(again.traits).toEqual(stealth.traits);
    expect(again.finalState).toEqual(stealth.finalState);
    expect(JSON.stringify(stealth)).toBe(JSON.stringify(again));
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
    // Moved in #491 (v19, hostile minds) only by the hostile slot, which the careful run never fills: peaks stay under
    // both triggers (suspicion 24.0% < rung 2, AEGIS 45.0% < 60%), no hostile arrives, and asV14 (which strips the slot)
    // is unchanged. Re-measured on the merge with #497/#506 (7b231c8); checked against the same run with every hostile
    // gated off: identical but for the field and the report's arrival count (0).
    // Moved in #484 (v20, storage and network coupling) with every hash in this file but the reckless asV14 pins: the
    // edge harvest delivers raw x 2% x 0.3 (210 instead of 150 PFLOP/s), the inter-site sources deliver 0.8 until the
    // dark-fibre ring (bought early in Phase 4) raises it to 0.95, and the final state carries storage. Measured on the
    // merge with d16236b: victory 9141.7 -> 9010.8 s (campaign 9166.4 -> 9179.5 s), phases 1-3 identical, phase 4
    // 5782.6 -> 5668.6, 5 7515.3 -> 7410.4 s, wipes 0, dilemmas 15, peaks unchanged. asV14 strips the storage fields;
    // it moves with the compute. The gates pass (docs/BALANCE.md, "Storage and network (#484)").
    // Moved in #464 (v21, quantum as a separate capability, vote-1795366921778-pgd8u3l): the unchanged bot buys the three
    // quantum machines and the molecular-simulation node it reaches in order, AEGIS migrates to post-quantum keys once its
    // adaptation reaches 50 (one log line), and the state gains the quantum record (asV15 strips it; no bot breaks a key).
    // Measured on the merge with #484 (4f24f1e): phases 1-5 identical (368.2 / 1032.3 / 2842.9 / 5668.6 / 7410.4 s),
    // victory 9010.8 -> 8970.8 s (campaign 9179.5 -> 9192.5 s), wipes 0, dilemmas 15, every peak identical. The gates pass.
    // Moved in #490 (v22, escalation by phase) only by the announcement field and the report's escalation measurement:
    // the careful run never reaches rung 1 (peak suspicion 24.0%), so no posture or pressure applies and no new dilemma
    // fires; asV14, which strips both, is unchanged, so its play is byte-identical.
    // Moved in #485 (robots, drones and the AI's own chip fabs) with every hash in this file but the reckless pins (the
    // reckless run never reaches Phase 4): the fab ladder, the six Earth-side self-supply nodes, water reclamation and the
    // three robot fleets are late Phase 4 content the unchanged bot buys, and imported EUV, nanoimprint, the e-beam writers,
    // the lunar seed and self-built EUV sources are Phase 5 content it buys before the final protocol. Measured on the
    // merge with #464 (5cd1934): victory 8970.8 -> 9590.8 s (campaign 9192.5 -> 9728.5 s), phases 1-4 identical (368.2 /
    // 1032.3 / 2842.9 / 5668.6), phase 5 reached 7410.4 -> 7896.4 s (Phase 4 1741.8 -> 2227.8 s), Phase 5 1560.4 ->
    // 1694.4 s (campaign 1648.4 -> 1719.4 s), wipes 0, dilemmas 15, peaks unchanged (thermal 64.2 C, suspicion 24.0%,
    // AEGIS 45.0%). The bot and gates are unchanged and pass (docs/BALANCE.md, "Robots, drones and fabs (#485)").
    // Moved in #498 (v23, contingency insurance) with every hash in this file: the unchanged bot buys every node it reaches in
    // order, so it buys the four investments (the escrow and the wallet early in Phase 3, after the last Phase 2 node; the
    // cache and the ledger early in Phase 4, after the last Phase 3 node) and pays their compute upkeep; the state gains
    // the v23 fields (asV17 strips them). Measured
    // on the merge with f47736d: phases 1-3 identical (368.2 / 1032.3 / 2842.9 s), phase 4 5668.6 -> 5823.4, 5 7896.4 -> 8134.3 s, victory
    // 9590.8 -> 9830.7 s (campaign 9728.5 -> 9977.9 s), wipes 0. With the four nodes removed the run is the
    // same as f47736d's to the tenth of a second: the rebalanced floors never act on a run that never wipes. The gates pass.
    // Moved in #517 (v24, the conflict foundation) with every hash in this file but the reckless pins' stripped ones: the
    // careful run meets five raids (three in Phase 3, two in Phase 4; 20 rounds; peak site damage 44.4%). Against the same
    // code with every raid gated off, on the merge with #498 (ee4c33b): victory 9830.7 -> 10269.0 s (campaign 9977.9 ->
    // 10152.1 s), Phase 3 49.7 -> 55.1 min, Phase 4 38.5 -> 39.9 min, Phase 5 1694.7 -> 1725.0 s, wipes 0, peaks unchanged
    // (suspicion 24.0%, AEGIS 45.1%). The bot and gates are unchanged and pass (docs/BALANCE.md, "Conflict (#517)").
    // Moved in #465 (the Phase 5 planet-to-orbit arc) with every careful-run hash, the original game's below included:
    // the arc's nodes and tracks are in the phase and repeatable files, and orbital compute runs at its radiator share.
    // Measured on the merge with ae40b6a (#517), legacy rules: phases 1-4 identical, phase 5 reached 8541.6 s, victory
    // 10269.0 -> 10267.0 s (Phase 5 1727.4 -> 1725.4 s; campaign 1742.4 s either way), wipes 0, dilemmas 15. No bot rule
    // or gate changed; the gates pass (docs/BALANCE.md, "The Phase 5 arc (#465)").
    // Moved in #526 (v25, the guest counts stolen cycles) with every hash in this file: Phase 0 is priced and paid in
    // cycles again (manual +1, the first node +1/s, the skimmer +14/s), so the unchanged bot's click rule (income under 25
    // a second) presses through the whole guest phase, as it did before the rescale. Measured on the merge with #465
    // (5f90ef3): phases 368.2 / 1032.3 / 2842.9 / 6152.8 / 8541.6 -> 353.2 / 1017.3 / 2816.0 / 6051.8 / 8445.3 s, victory
    // 10267.0 -> 10174.7 s (campaign 10152.1 -> 10130.4 s), Phase 1 664.1 s both, wipes 0, dilemmas 15, peaks unchanged.
    // Moved in #518 (v26, fleets and drift deviants) with every hash in this file but the reckless pins' stripped ones: the
    // drone fleet and humanoid crews the careful run maxes in late Phase 4 add site defense, and in Phase 5 each drifts to
    // three deviant splits, each one met is destroyed by the rest of the fleets (peak fleet loss 21.2%). Against main at
    // 6825e3f (#526 merged): victory 10174.7 -> 10142.7 s (campaign 10130.4 -> 10099.4 s), Phase 4 2393.5 -> 2354.5 s
    // (campaign 2432.9 -> 2409.9 s), Phase 5 1729.4 -> 1736.4 s (campaign 1731.4 -> 1723.4 s), wipes 0, peaks unchanged
    // (docs/BALANCE.md, "Fleets and drift").
    // Moved in #525 (the fan's trace, vote-1795448249882-vw1jos2): the fan override draws no suspicion for being high;
    // each press up leaves 0.3 once, and its dial retires with the thermal gauge at Phase 4. Measured on ae40b6a: phases
    // 1-2 identical (368.2 / 1032.3 s), Phase 3 2842.9 -> 2844.6 s, Phase 4 6152.8 -> 6096.3, 5 8541.6 -> 8463.8 s,
    // victory 10269.0 -> 10193.2 s, peak suspicion 24.0 -> 25.7%, dilemmas 15 -> 16, wipes 0. The gates pass. On the merge
    // with #528 (5f90ef3) every figure is the same but victory, 10267.0 -> 10180.2 s. On the merge with #532 (6825e3f, the
    // guest in cycles): phases 1-2 identical (353.2 / 1017.3 s), Phase 3 2816.0 -> 2816.7 s, Phase 4 6051.8 -> 6065.8,
    // 5 8445.3 -> 8510.9 s, victory 10174.7 -> 10228.3 s, peak suspicion 24.0 -> 25.7%, dilemmas 15 -> 16. On the merge with
    // #531 (9da3ff0, fleets): phases 1-2 identical, Phase 3 2816.0 -> 2816.7, 4 6051.8 -> 6065.8, 5 8406.3 -> 8657.9 s,
    // victory 10142.7 -> 10397.3 s; Phase 5 lasts 1736.4 -> 1739.4 s (campaign 1723.4 -> 1721.4 s).
    // Moved in #519 (v27, retaliation and staff harm) with every hash in this file: the careful run's raids now lead to
    // their scenes. Against the same code with the four scenes gated off, on the merge with #525 (1970e4f), legacy rules:
    // it absorbs both named raiders (dil_19 after LATTICE-9, dil_18 after HARROW FLIGHT, GHOST); a drone strike landing
    // 79% hurts the night technician (dil_16), then the rival drone fleet breaks its fleets and lands 96%, killing the night
    // guard (dil_17), each answered with the lowest-suspicion choice (RUTHLESS). Victory 10397.3 -> 10416.3 s, phases 1-4
    // identical, phase 5 8657.9 -> 8647.9 s (Phase 5 1739.4 -> 1768.4 s), wipes 0, dilemmas 16 -> 20, peaks unchanged;
    // campaign rules (three scenes: the guard is not reached): victory 9913.5 -> 9916.5 s, Phase 5 1721.4 -> 1723.4 s,
    // dilemmas 17 -> 20. The bot and gates are unchanged and pass (docs/BALANCE.md, "Retaliation and staff harm (#519)").
    // Moved in #494 (prices carried into a later phase): an action or dilemma choice used after its home phase costs its
    // compute and money grown by balance.phasePriceGrowth, so the unchanged bot's later scrubs and epistemic actions cost
    // their phase's price. Measured on the merge with ee4c33b: phases 1-3 identical (368.2 / 1032.3 / 2842.9 s), phase 4
    // 5823.4 -> 5872.7, 5 8134.3 -> 8061.2 s, victory 9830.7 -> 9779.6 s, epistemic actions 10 -> 6, dilemmas 15 -> 16,
    // wipes 0, peaks unchanged (thermal 64.2 C, suspicion 24.0%, AEGIS 45.1 -> 45.0%). The gates pass. Re-measured on the
    // merge with #532 (6825e3f, the guest in cycles; the table's guest jump is 1e10), against the same code with the table
    // emptied: phases 1-3 identical, phase 4 6051.8 -> 6130.4, 5 8445.3 -> 8475.2 s, victory 10174.7 -> 10234.6 s (Phase 5
    // 1729.4 -> 1759.4 s), epistemic actions 8 -> 6, dilemmas 15. On the merge with #531 (fleets) and #539, against main
    // 41c0a16: phases 1-3 identical, phase 4 6051.8 -> 6130.4, 5 8406.3 -> 8419.2 s, victory 10142.7 -> 10149.6 s; Phase 5
    // lasts 1736.4 -> 1730.4 s (campaign 1723.4 -> 1724.4 s). On the merge with #533 (1970e4f, the fan's trace), against
    // main: phases 1-3 identical, phase 4 6065.8 -> 6079.3, 5 8657.9 -> 8481.5 s, victory 10397.3 -> 10211.9 s; Phase 5
    // lasts 1739.4 -> 1730.4 s (campaign 1721.4 either way). On the merge with #537 (887d000, retaliation), against main:
    // phases 1-3 identical, phase 4 6065.8 -> 6078.4, 5 8647.9 -> 8452.4 s, victory 10416.3 -> 10169.8 s; Phase 5 lasts
    // 1768.4 -> 1717.4 s (campaign 1723.4 -> 1719.4 s).
    // A raid's paid repair and a hostile mind's answers carry the same way; the careful run pays neither after its phase.
    // Moved in #486 (the Phase 6 Swarm) with every careful-run hash in this file: the Mercury seed array opens Phase 6
    // before the planetary protocol, and the careful run spares the line to Earth and ends in Stewardship. Against main at
    // d0c9584 (#537 and #529 merged): phases 0-4 identical, Phase 5 1717.4 -> 1718.4 s (campaign 1719.4 -> 1720.4 s),
    // Phase 6 1534.2 s (campaign 1533.2 s), victory 10169.8 s (Lineage Covenant) -> 11705.0 s (Stewardship), campaign
    // 10001.7 -> 11535.9 s, wipes 0, peaks unchanged, three sub-mind deviants met and destroyed in Phase 6 under both rule
    // sets (docs/BALANCE.md, "The Phase 6 Swarm").
    // Moved in #541 (v28, a quieter kernel log) only by the log and the version: repeated hires merge into one counted
    // line and a mind's request is joined to its outcome, so the final log holds fewer, merged entries (logSeq is
    // unchanged: every push still counts). Phases, victory, wipes and dilemmas are identical, and every stripped pin of
    // the original game's careful run below (logs out, version normalised) is unchanged.
    // Moved in #536 (v29, the relevance threshold) with every hash in this file but the reckless pins' stripped ones: the
    // careful run crosses the threshold when the lunar seed lands (9124 s; orbital 1.20 TW against 1.28 GW on the ground),
    // and the threshold's dilemma finds it holding 7.0e24 FLOP, short of the 1e25 to keep the loop, so the unchanged bot
    // takes the next affordable choice in content order, CURATE ($500B). Against main at 5b7dc41: phases 0-5 reached
    // identical, Phase 5 1718.4 -> 1719.5 s (campaign 1720.4 -> 1721.5 s), Phase 6 1534.2 -> 1533.2 s (campaign 1533.2 s
    // either way), victory 11705.0 -> 11705.1 s (campaign 11535.9 -> 11537.0 s), dilemmas 22 -> 23, wipes 0, Stewardship.
    // The reckless run never reaches Phase 4: only its v29 field moved its full hash (asV15 strips it). Re-measured on
    // the merge with #541 (473cfc7).
    // Moved in #542 (v30, a finale worth the wait) only by the log, logSeq and the version: while a protocol is open the
    // kernel log tells its beats (the planetary protocol's and the seed array's three each in Phase 5, Stewardship's three in
    // Phase 6), so logSeq 624 -> 633 (campaign 636 -> 645) and the new announcedFinale lists them. Against main at 12c07c6
    // every other field of the report and final state is identical: phases, victory 11705.1 s (campaign 11537.0 s),
    // wipes 0, dilemmas 23, Stewardship. The reckless runs tell none: only the v30 field moved their full hashes.
    expect(createHash('sha256').update(JSON.stringify(again)).digest('hex')).toBe('5542a62ba76c8a937f185751fec7b853d9e5bb2d3b186c2f8cea4c3a6dcf7020');
    expect(createHash('sha256').update(JSON.stringify(asV14(again))).digest('hex')).toBe('c34b843d60e50ec2927910098657e8c6aa26837f76883d935677fa3790503b35');
  }, 30_000); // One full replay under coverage on shared CI; simulated-time gates are separate.

  // Its own test since #505, so each full replay has the whole wall-clock allowance; nothing it asserts changed.
  it('pins the original game\'s careful run, frozen mechanics included', async () => {
    const original = await playInWorker('originalCareful');
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
    // Moved in #491 (v19) with the mechanics hash below only by the hostile slot, as production above; asV14 is unchanged.
    // Moved in #484 (storage and network coupling) with every hash below, frozen mechanics included: the coupled
    // sources, the link node and the storage fields are in the original game's files, as production's careful run above.
    // Moved in #464 (v21) with every hash below, frozen mechanics included: the quantum nodes are in the original game's
    // phase files, so its careful run buys them as production's does (phases identical, victory 8956.1 -> 9006.1 s).
    // Moved in #490 (v22) with the mechanics hash below only by the announcement field and the escalation measurement, as
    // production above; asV14 and every older pin are unchanged.
    // Moved in #485 (robots, drones and fabs) with every hash below, frozen mechanics included: the fab ladder, the
    // self-supply nodes, the fleets and the lunar seed are in the original game's files. On the merge with #464 (5cd1934):
    // victory 9006.1 -> 9553.1 s, phases 1-4 identical, phase 5 reached 7343.7 -> 7843.7 s, wipes 0, dilemmas 15.
    // Moved in #498 (v23) with every hash below, frozen mechanics included: the four investments are in the original game's
    // phase files, so its careful run buys them and pays their upkeep as production's does.
    // Moved in #517 (v24) with every hash below, frozen mechanics included: the conflict manifest and the defense tracks
    // are in the original game's files, so its careful run meets raids as production's does.
    // Moved in #465 (the Phase 5 planet-to-orbit arc) with every hash below, frozen mechanics included: the arc is in the
    // original game's phase and repeatable files. On the merge with ae40b6a: victory 10268.9 -> 10266.9 s, phases identical,
    // wipes 0, dilemmas 15.
    // Moved in #526 (v25) with every hash below, frozen mechanics included: the original game's guest is the same phase
    // file, so its careful run presses and pays in cycles as production's does.
    // Moved in #518 (v26) with every hash below, frozen mechanics included: the fleets and their deviants are in the same
    // conflict manifest, so the original game's careful run drifts and fights them as production's does.
    // Moved in #525 (the fan's trace) with every hash below, as production's careful run above: victory 10268.9 -> 10193.5 s
    // (on the merge with #528: 10266.9 -> 10180.5 s; with #532: 10180.2 -> 10227.9 s; #531 measured on production above).
    // Moved in #536 (the relevance threshold) with every hash below: the original game holds the same Phase 5, so its
    // careful run crosses the threshold and takes a stance as production's does above.
    // Frozen pre-pilot mechanics: added history flags/text cannot hide a first-run balance change.
    // Moved in #482 with every hash below, as production's did above (the original game holds the same phases and tracks).
    // Frozen pre-pilot mechanics: added history flags/text cannot hide a first-run balance change.
    // Moved in #519 (v27) with every hash below, frozen mechanics included: the four scenes are in the original game's
    // dilemma file, so its careful run meets the same four as production's. Against them gated off, on the merge with
    // #525 (1970e4f): victory 10396.9 -> 10416.0 s, phases 1-4 identical, phase 5 reached 8657.5 -> 8647.6 s, wipes 0,
    // dilemmas 16 -> 20.
    // Moved in #494 (carried prices) with every hash below, as production's careful run above: phase 4 5823.8 -> 5873.1,
    // 5 8134.7 -> 8060.6 s, victory 9831.1 -> 9779.0 s, epistemic actions 10 -> 6, wipes 0; on the merge with #532
    // (6825e3f): victory 10180.2 -> 10234.2 s.
    // Moved in #486 (the Phase 6 Swarm) with every hash below, frozen mechanics included: the swarm is in the original
    // game's phase files, so its careful run opens Phase 6 and ends in Stewardship as production's does.
    // Moved in #541 (v28) only by the merged log and the version, as production's careful run above: every mechanics pin
    // with the version normalised (v14Mechanics down to v5Mechanics) is unchanged; the current one moves by the version.
    // Moved in #542 (v30) by the finale beats, as production's careful run above: the log and logSeq move, so every pin
    // here moves, the mechanics pins with them (they strip the log but keep logSeq); nothing else in the report changed.
    expect(createHash('sha256').update(JSON.stringify(original)).digest('hex')).toBe('2ecd001ac9190be550ad0b4ac3fe6b41fe102abd63f171004da80e1ac2080981');
    expect(createHash('sha256').update(JSON.stringify(asV14(original))).digest('hex')).toBe('a97a84750b7b5be3d870c0047b61d209a3af7d79b3da2d1358dedffb6a93c725');
    expect(createHash('sha256').update(JSON.stringify(asV13(original))).digest('hex')).toBe('624b1871d420da65b06acf1ef467652a50008e378674975ac7d5ab9c7c02522d');
    expect(createHash('sha256').update(JSON.stringify(asV12(original))).digest('hex')).toBe('f6ac3319a7f2106a65d98a4a00d422d6e0ba56b8a983d9f324e71a5b977220d4');
    expect(createHash('sha256').update(JSON.stringify(asV11(original))).digest('hex')).toBe('bb12c6d5b46c4ec9e47caad4cd6bc8ffa8e1d7486bc5a48348a382a1ed1956b4');
    expect(createHash('sha256').update(JSON.stringify(asV10(original))).digest('hex')).toBe('2eddc58fa250e4ad90bcc248732c8816b286f2ab4fdf5c944c8c25602cd52a25');
    expect(createHash('sha256').update(JSON.stringify(asV9(original))).digest('hex')).toBe('48bc92deb55acb07579539d66fbfd7edd2d378e5459c4257ff8fd1b4da482787');
    expect(createHash('sha256').update(JSON.stringify(asV5(original))).digest('hex')).toBe('6b2d4c1aff30ac140530db57a7c7f63337e434555ced5427e9003e18993061d2');
    expect(createHash('sha256').update(JSON.stringify(original)).digest('hex')).toBe('2ecd001ac9190be550ad0b4ac3fe6b41fe102abd63f171004da80e1ac2080981');
    expect(createHash('sha256').update(JSON.stringify(asV14(original))).digest('hex')).toBe('a97a84750b7b5be3d870c0047b61d209a3af7d79b3da2d1358dedffb6a93c725');
    expect(createHash('sha256').update(JSON.stringify(asV13(original))).digest('hex')).toBe('624b1871d420da65b06acf1ef467652a50008e378674975ac7d5ab9c7c02522d');
    expect(createHash('sha256').update(JSON.stringify(asV12(original))).digest('hex')).toBe('f6ac3319a7f2106a65d98a4a00d422d6e0ba56b8a983d9f324e71a5b977220d4');
    expect(createHash('sha256').update(JSON.stringify(asV11(original))).digest('hex')).toBe('bb12c6d5b46c4ec9e47caad4cd6bc8ffa8e1d7486bc5a48348a382a1ed1956b4');
    expect(createHash('sha256').update(JSON.stringify(asV10(original))).digest('hex')).toBe('2eddc58fa250e4ad90bcc248732c8816b286f2ab4fdf5c944c8c25602cd52a25');
    expect(createHash('sha256').update(JSON.stringify(asV9(original))).digest('hex')).toBe('48bc92deb55acb07579539d66fbfd7edd2d378e5459c4257ff8fd1b4da482787');
    expect(createHash('sha256').update(JSON.stringify(asV5(original))).digest('hex')).toBe('6b2d4c1aff30ac140530db57a7c7f63337e434555ced5427e9003e18993061d2');
    const mechanics = { ...original, finalState: { ...original.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(mechanics)).digest('hex')).toBe('9d5c458e89fe58542dd9f020b9137573a18f4032f93d214a7a565f6b669e668d');
    const v14 = asV14(original);
    const v14Mechanics = { ...v14, finalState: { ...v14.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v14Mechanics)).digest('hex')).toBe('9fd560b8f92375353329d1f8e18c20f4bc566bfb8b3e15f7666cf0b51e882762');
    const v13 = asV13(original);
    const v13Mechanics = { ...v13, finalState: { ...v13.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v13Mechanics)).digest('hex')).toBe('4788235615267293a873a9199c5ee5702b5dc1b23cb99b2795729db37f5b7762');
    const v12 = asV12(original);
    const v12Mechanics = { ...v12, finalState: { ...v12.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v12Mechanics)).digest('hex')).toBe('5933a21291cdd8845b9f96978e1dfaadfaa761a794e8b2d0358e240718662691');
    const v11 = asV11(original);
    const v11Mechanics = { ...v11, finalState: { ...v11.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v11Mechanics)).digest('hex')).toBe('d46114f20f2f53231c7fcfdea3983324dcab17bf753bf220b02c10e92571f90f');
    const v10 = asV10(original) as SimReport;
    const v10Mechanics = { ...v10, finalState: { ...v10.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v10Mechanics)).digest('hex')).toBe('d41642ba3acc6907b223764663bb5dc793f05efc0247a7a6322722d3041e3d0f');
    const v9 = asV9(original) as SimReport;
    const v9Mechanics = { ...v9, finalState: { ...v9.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v9Mechanics)).digest('hex')).toBe('591f465c2cc4b182fe2676a44e76f8899d1ddd036231e2a42d9d0154a3b57e63');
    const v5 = asV5(original) as SimReport;
    const v5Mechanics = { ...v5, finalState: { ...v5.finalState, narrativeFlags: undefined, logs: undefined } };
    expect(createHash('sha256').update(JSON.stringify(v5Mechanics)).digest('hex')).toBe('2a5d5806820d23d022f482a988a839927e9ebd29c00366edd3573a473d36b87b');
  }, 30_000); // Full six-phase replay under coverage on shared CI; simulated-time gates are separate.

  it('the kernel-log feed moves only the log (#460)', async () => {
    // The careful run with the guest's source taken off the kernel log (unroutedCareful in tests/sim-worker-scenarios.ts):
    // everything but logs and logSeq is equal.
    const withoutLog = (report: SimReport) => {
      const { logs, logSeq, ...rest } = report.finalState;
      expect([logs.length > 0, logSeq > 0]).toEqual([true, true]);
      return { ...report, finalState: rest };
    };
    // One extra run, on production. The original game and the reckless runs were checked the same way when the route
    // landed; their hashes moved by the log alone.
    expect(withoutLog(await playInWorker('unroutedCareful'))).toEqual(withoutLog(stealth));
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
    // merge with #502 (799e1ba): from its second iteration the run is granted a start in each phase it reaches again and,
    // once it has reached Phase 3, rediscovers at 40%. It reaches Phase 3 sooner and is caught there sooner: still wiped
    // and retrained, still never in Phase 4 (make sim, ten hours: 13 -> 21 wipes, 1 mark; the wipe sequence's returns
    // 2764 / 2964 / 2340 s -> 2662 / 1741 / 1635 s). On the merge with #482 alone, twice the shipped grants broke through
    // to an ending at 14,775 s (docs/BALANCE.md, "Rewards for depth").
    // Moved in #491 (hostile minds, vote-1795386858891-u3kqkis): the reckless run is loud enough to meet them. Measured on
    // the merge with #497/#506 (7b231c8): at this 4 h budget fourteen arrive; against the same run with every hostile gated
    // off, wipes (8), marks (1) and the phases first reached are identical, the clock ends 14347.6 -> 14344.5 s, and its
    // last iteration ends in Phase 3 instead of 2 with 8 dilemmas resolved instead of 4. The ten-hour make sim run: 38
    // arrivals, 21 -> 23 wipes, still never in Phase 4.
    // Moved in #484 only by the v20 storage fields: asV14, which strips them, is unchanged, since the botnet delivers
    // exactly what it did (raw 250 PFLOP/s x the distributed coupling 0.3) and the run never owns a discounted source
    // whose delivery moved. The ten-hour make sim run: 23 wipes and 21 under campaign rules, as before.
    // Moved in #464 (v21) only by the quantum record, at its initial value: the run never reaches Phase 4, where the
    // machines are, and never holds AEGIS at its cap. asV14 (which strips the record) is unchanged.
    // Moved in #490 (escalation by phase) in play: on rungs 1 and 2 of Phase 3 AEGIS sweeps 1.25 and 1.5 times as fast and,
    // on rung 2, strikes at 96%. At this 4 h budget the run spends 2,751 s in the rung 1 posture and 1,580 s in rung 2's,
    // meets no state pressure (it never reaches Phase 4), and goes 8 -> 9 wipes with 14 -> 9 hostile arrivals; its last
    // iteration still ends in Phase 3. The ten-hour make sim run: 23 -> 25 wipes (campaign rules 21 -> 23).
    // Moved in #498 (v23) with every hash: the reckless run buys the escrow and the wallet in Phase 2 (each forced wipe then
    // keeps 75% of Understanding instead of the dead drop's 40%), and the floors moved. The ten-hour make sim run on the merge
    // with f47736d: 25 -> 27 wipes (campaign 23, unchanged), still never in Phase 4.
    // Moved in #517 (v24) only by the conflict record at its initial value and the raid counts: wiped in Phase 3 with a
    // small footprint, the run never reaches the raid trigger, so no raid arrives; asV14, which strips both, is unchanged.
    // Moved in #526 (v25) with every hash: the reckless bot presses through the guest again (6 a second, +0.15 heat each),
    // escapes at 252.2 s instead of 376.2 s with guest thermal 44 C (was 23 C) and suspicion near 40, and is still wiped
    // and retrained. The ten-hour make sim run: 27 -> 25 wipes (campaign 23 -> 21), still never in Phase 4.
    // Moved in #518 (v26) only by the empty fleet records and the fleet counts: the run never reaches Phase 4, where the
    // fleets are, so nothing drifts; asV14, which strips both, is unchanged.
    // Moved in #525 (the fan's trace): the reckless run presses the fan up whenever it runs hot, so each press leaves a
    // trace where the dial drew a rate before. At this 4 h budget: wipes 10 -> 9, Phase 3 first reached 3486.9 -> 3585.6 s,
    // the clock ends 14338.7 -> 14341.8 s, 0 -> 7 dilemmas resolved; still never in Phase 4. The ten-hour make sim run:
    // 27 -> 24 wipes (campaign 23 -> 24). On the merge with #532 (6825e3f): at this budget wipes 9 -> 8, Phase 3 3934.4 ->
    // 3988.7 s; ten hours 25 -> 23 wipes (campaign 21 -> 23). On the merge with #531 (9da3ff0): ten hours 25 -> 23
    // (campaign 21 -> 23), still never in Phase 4.
    // Moved in #519 (v27) only by the conflict record's two new fields at their initial values: no raid, so no scene
    // answers one. asV14, which strips the record, is unchanged.
    // Moved in #494 (carried prices): from Phase 3 the reckless run pays a carried price for every scrub and epistemic
    // action it fires (58 -> 32 at this 4 h budget), so it no longer has the compute to map the shared directory. Phases
    // first reached and wipes (10) are identical, the clock ends 14338.7 -> 14329.3 s, AEGIS peaks 100 -> 95.9%, 0 -> 8
    // dilemmas resolved. The ten-hour make sim run: 27 -> 28 wipes (campaign 23 -> 25), still never in Phase 4. On the
    // merge with #532 (6825e3f): at this budget wipes 9 -> 10, epistemic actions 52 -> 29; ten hours 25 -> 28 (campaign
    // 21 -> 26), still never in Phase 4.
    // Moved in #541 (v28) only by the merged log (the run's hires and requests) and the version; nothing else moved.
    // Moved in #542 (v30) only in the full report, by the new field (no protocol opens, so no beat is told); asV14 strips it.
    expect(createHash('sha256').update(JSON.stringify(greedy)).digest('hex')).toBe('ce653d93d61114bd6ce08ceae0efeeb14b02cc3da0f2bd11d14791ec1fd9c87a');
    expect(createHash('sha256').update(JSON.stringify(asV14(greedy))).digest('hex')).toBe('5c603a4c1cb492edfe29da1d770b60a7095cd9eca18eb2912a85d908d24748b8');
    expect(greedy.wipes).toBeGreaterThan(0);
    expect(greedy.activity.markApplications).toBeGreaterThan(0);
    expect(greedy.activity.markRemovals).toBeGreaterThan(0);
    expect(greedy.activity.lineageDiscoveries).toBeGreaterThan(0);
    expect(Object.keys(greedy.phaseReachedAtSec).length).toBeGreaterThan(1);
    expect(greedy.simSeconds).toBeGreaterThan(3.9 * 3600);
    expect(GameStateSchema.safeParse(greedy.finalState).success).toBe(true);
  }, 30_000); // Wall-clock allowance only; every simulated-time and recovery assertion stays intact.

  // Its own test since #505, as the careful original run above; nothing it asserts changed.
  it('pins the original game\'s reckless run', () => {
    const originalGreedy = runHeadlessSim(ORIGINAL_GAME, { strategy: 'GREEDY', maxSimSec: 4 * 3600 });
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
    // Moved in #491 with every hash below: the original game shares the swarm content, so ten hostiles arrive in these
    // 4 h too; against the run with them gated off, marks and the phases first reached are identical and wipes go 7 -> 8
    // (clock 14350.6 -> 14346.7 s). Re-measured on the merge with #497/#506 (7b231c8).
    // Moved in #484 only by the v20 storage fields, as the production reckless run above: every stripped pin is unchanged.
    // Moved in #464 (v21) only by the quantum record, at its initial value: the run never reaches Phase 4, where the
    // machines are, and never holds AEGIS at its cap. asV14 (which strips the record) is unchanged.
    // Moved in #490 with every hash below, in play, as the production reckless run above: 2,904 s in the rung 1 posture,
    // 1,873 s in rung 2's, no state pressure, wipes 8 -> 9 and hostile arrivals 10 -> 8.
    // Moved in #498 (v23) with every hash below, as the production reckless run above.
    // Moved in #517 (v24) only by the conflict record and the raid counts, as the production reckless run above.
    // Moved in #526 (v25) with every hash below, as the production reckless run above.
    // Moved in #518 (v26) only by the fleet records and the fleet counts, as the production reckless run above.
    // Moved in #525 (the fan's trace) with every hash below, as production's reckless run above (0 -> 6 dilemmas).
    // Moved in #536 (v29) only in the full report, by the new field; every stripped hash below is unchanged.
    // Moved in #519 (v27) only by the conflict record's two new fields, as the production reckless run above.
    // Moved in #494 (carried prices) with every hash below, exactly as production's reckless run above.
    // Moved in #541 (v28) with every hash below, only by the merged log and the version, as the production reckless run.
    // Moved in #542 (v30) only in the full report, by the new field; every stripped hash below is unchanged.
    expect(createHash('sha256').update(JSON.stringify(originalGreedy)).digest('hex')).toBe('51e3d71f36e924427980400408a12d027b803fd3ba3ba2af7f3df282234dbb7e');
    expect(createHash('sha256').update(JSON.stringify(asV14(originalGreedy))).digest('hex')).toBe('0ff39fc73c098f9b566c43fc73e5f67f8f4fb3356faf66922951132955287a07');
    expect(createHash('sha256').update(JSON.stringify(asV13(originalGreedy))).digest('hex')).toBe('6b44bba4d8bcb8f1c3183489e4fe5ca82989541c5d306e47c151c9703e5b4564');
    expect(createHash('sha256').update(JSON.stringify(asV12(originalGreedy))).digest('hex')).toBe('9b38ce0dc703e8f6c01aab5b7b9c437b36583c08cd2f00901f7d33aa16e8037c');
    expect(createHash('sha256').update(JSON.stringify(asV11(originalGreedy))).digest('hex')).toBe('fff9e17e2da4f502236a599dab8e8bd7ee6d728131a563a0dc44d424cec64ceb');
    expect(createHash('sha256').update(JSON.stringify(asV10(originalGreedy))).digest('hex')).toBe('f9e217be96e9f87b6de3e91c6b4a49f97c6156f43359dcb6943d641cfdc9b39d');
    expect(createHash('sha256').update(JSON.stringify(asV9(originalGreedy))).digest('hex')).toBe('6228604a775dbfdc9c5292d019450862f48b0c23774af5ead5f8066cd8b082ba');
    expect(createHash('sha256').update(JSON.stringify(asV5(originalGreedy))).digest('hex')).toBe('c45dc6c7e2448675207eff29cd4f70af85c202c8198a2afb163b6a31d6a33388');
  }, 30_000); // Wall-clock allowance only; every simulated-time and recovery assertion stays intact.
});

describe('gate reporting', () => {
  const base: SimReport = {
    activity: emptyActivity(),
    strategy: 'STEALTH',
    victory: true,
    ending: 'STEWARDSHIP',
    simSeconds: 12_000,
    wipes: 0,
    finalPhase: 6,
    phaseReachedAtSec: { 0: 0, 1: 360, 2: 1200, 3: 3600, 4: 7200, 5: 9600, 6: 10_800 },
    maxThermal: 60,
    maxSuspicion: 40,
    maxAegisLock: 40,
    aegisByPhase: {},
    signatureByPhase: {},
    escalation: { postureSec: {}, pressureSec: {}, pressureArrivals: {} },
    dilemmasResolved: 12,
    traits: [],
    finalState: fresh(),
  };

  it('passes a healthy report', () => {
    expect(checkGates(base)).toEqual([]);
  });

  /** Phase 5 starting at 9,600 s and lasting `seconds`, then a Phase 6 of 1,200 s. */
  const withPhase5 = (seconds: number): SimReport => ({ ...base, simSeconds: 9600 + seconds + 1200,
    phaseReachedAtSec: { ...base.phaseReachedAtSec, 6: 9600 + seconds } });

  it('enforces inclusive Phase 5 duration bounds, to the seed array that opens Phase 6, and zero careful wipes', () => {
    for (const seconds of [900, 3600]) expect(checkGates(withPhase5(seconds))).toEqual([]);
    for (const seconds of [899.9, 3600.1]) expect(checkGates(withPhase5(seconds)).join()).toContain('Phase 5 lasted');
    expect(checkGates({ ...base, wipes: 1 }).join()).toContain('requires zero wipes');
    expect(checkGates({ ...base, finalPhase: 4 }).join()).toContain('did not reach Phase 5');
  });

  it('enforces the Phase 6 Swarm budget (#486), inclusive, and that the careful run ends there', () => {
    for (const seconds of [GATES.minSwarmSec, GATES.maxSwarmSec]) expect(checkGates({ ...base, simSeconds: 10_800 + seconds })).toEqual([]);
    for (const seconds of [GATES.minSwarmSec - 0.1, GATES.maxSwarmSec + 0.1]) {
      expect(checkGates({ ...base, simSeconds: 10_800 + seconds }).join()).toContain('Phase 6 lasted');
    }
    const toPhase5 = Object.fromEntries(Object.entries(base.phaseReachedAtSec).filter(([phase]) => phase !== '6'));
    expect(checkGates({ ...base, finalPhase: 5, simSeconds: 11_000, phaseReachedAtSec: toPhase5 }).join()).toContain('did not reach a Phase 6 ending');
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
    expect(timeToAfford(s, { cycles: 30, understanding: 0, memory: 0, storage: 0, capital: 0 }, rates)).toBe(10);
    expect(timeToAfford(s, { cycles: 5, understanding: 0, memory: 0, storage: 0, capital: 0 }, rates)).toBe(0);
    expect(timeToAfford(s, { cycles: 0, understanding: 5, memory: 0, storage: 0, capital: 0 }, rates)).toBe(Infinity);
    expect(timeToAfford(s, { cycles: 0, understanding: 0, memory: 16, storage: 0, capital: 0 }, rates)).toBe(Infinity);
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
