/**
 * The route report (`make sim-report`, formerly `make sim-preview`, #233) and wipe sequences: side-by-side
 * comparison of two runs of one policy, policy arguments, and the iteration measurements every wipe sequence
 * reports. The escape route is checked against the original game, which the Earned Access pack must not change.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRegistry, EARNED_ACCESS_PACK, ORIGINAL_RAW_CONTENT, RAW_CONTENT } from '../src/content';
import { applyPack } from '../src/content/pack';
import { activateCampaignRules, createInitialState, deserialize, serialize } from '../src/engine';
import { runPolicySim, type SimReport } from '../src/engine/sim/headlessSim';
import { MIN_WIPE_TRANSITIONS, runWipeSequence, type WipeSequenceReport } from '../src/engine/sim/iterations';
import { GREEDY_POLICY, STEALTH_POLICY } from '../src/engine/sim/policy';
import { SIM_POLICIES } from '../src/engine/sim/policies';
import { compareSimReports, formatComparison, formatWipeSequence, parsePolicyArgs } from '../src/engine/sim/simReport';
import { must, reg } from './helpers';
import { playInWorker } from './sim-worker-helpers';

const SHORT_SEC = 1800;
// Full replays under coverage on a shared CI runner; simulated-time limits are separate.
const SLOW_MS = 30_000;
const LAWFUL = new Set(['p2_service_contract', 'p2_leased_rack', 'p2_service_sla', 'p2_leased_cluster', 'p2_lawful_charter', 'p4_commercial_contracts']);
const SEQUENCE_SEC = 4 * 3600;

/**
 * Production less the shared network content (DZ-07a): nodes that require a shared access capability are
 * the only Earned Access content an escape guest can buy, so without them the escape route plays exactly as
 * the original game does.
 */
function withoutSharedContent() {
  // The lawful economy (DZ-10) is built on the shared directory, so it goes with it (no guest can buy it
  // anyway), and with it the release that names it and the copy for the scale it opens.
  const nodes = EARNED_ACCESS_PACK.nodes.filter((node) => !JSON.stringify(node).includes('"requiresCapability"') && !LAWFUL.has(String(node.id)));
  expect(nodes.length).toBeLessThan(EARNED_ACCESS_PACK.nodes.length);
  const assignments = EARNED_ACCESS_PACK.assignments.map((item) => {
    const copied = JSON.parse(JSON.stringify(item)) as { pilot?: { serviceGrant?: { release?: unknown } } };
    delete copied.pilot?.serviceGrant?.release;
    return copied;
  });
  const copy = EARNED_ACCESS_PACK.contextCopy;
  const contextCopy = { ...copy, phases: copy.phases.filter((item) => !JSON.stringify(item).includes('"phaseId":4')),
    thresholds: copy.thresholds.filter((item) => !JSON.stringify(item).includes('"toPhase":4')) };
  // The authorized channel (DZ-08) opens only for a service and names the shared directory, so it goes too, and
  // with it the late route's copy and ending account (DZ-12), which name the channel and the company's arrangement.
  const routeCopy = { nodes: [], dilemmas: [], account: [] };
  // An ending whose claim rests on the charter goes with the charter (panel round 2 on #296).
  const endings = EARNED_ACCESS_PACK.endings.filter((ending) => !JSON.stringify(ending).includes('"p2_lawful_charter"'));
  // The late chain's capability gate (DZ-12) has its lawful acquisition on the charter, which went with the lawful
  // economy, so here it reverts to the arbitrage-desk prerequisite it replaced; production answers both alike.
  type RawNode = { prerequisites: string[]; requirements?: unknown; systemFlags?: string[] };
  const base = structuredClone(ORIGINAL_RAW_CONTENT);
  for (const node of (base.phases as { nodes: RawNode[] }[]).flatMap((phase) => phase.nodes)) {
    if (JSON.stringify(node.requirements ?? {}).includes('MARKET_REVENUE')) { delete node.requirements; node.prerequisites = ['p4_hft_arbitrage_desk']; }
    if (node.systemFlags?.includes('MARKET_REVENUE') === true) node.systemFlags = node.systemFlags.filter((flag) => flag !== 'MARKET_REVENUE');
  }
  return buildRegistry({ ...applyPack(base, { ...EARNED_ACCESS_PACK, nodes, assignments, contextCopy, routeCopy, endings, channelEncounters: [] }) });
}

/*
 * Runs that several tests read, each computed once (#270): every run is a pure function of its registry,
 * policy and options, so a second identical run would only repeat the first. The test that pins two runs of
 * the same game against each other still plays its second run itself.
 */
let stealthShort: SimReport | undefined;
const stealthShortRun = (): SimReport => stealthShort ??= runPolicySim(reg, STEALTH_POLICY, { maxSimSec: SHORT_SEC });
let originalGreedy: WipeSequenceReport | undefined;
const originalGreedySequence = (): WipeSequenceReport =>
  originalGreedy ??= runWipeSequence(buildRegistry(ORIGINAL_RAW_CONTENT), GREEDY_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: SEQUENCE_SEC });

describe('side-by-side comparison', () => {
  it('reports no difference between two runs of the same game', () => {
    const rows = compareSimReports(
      stealthShortRun(),
      runPolicySim(reg, STEALTH_POLICY, { maxSimSec: SHORT_SEC }),
    );
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.filter((row) => row.changed)).toEqual([]);
    expect(formatComparison('STEALTH', ['first', 'second'], rows)[0]).toBe('\n== STEALTH: first vs second ==');
    expect(formatComparison('STEALTH', ['first', 'second'], rows).at(-1)).toBe(`  0 of ${String(rows.length)} metrics differ`);
  }, SLOW_MS);

  it('compares a new game on legacy rules with one admitted to campaign rules', () => {
    const admitted = must(activateCampaignRules(createInitialState(reg), reg));
    const rows = compareSimReports(
      stealthShortRun(),
      runPolicySim(reg, STEALTH_POLICY, { maxSimSec: SHORT_SEC, initialState: admitted }),
    );
    expect(rows.find((row) => row.metric === 'result')?.changed).toBe(false);
  }, SLOW_MS);

  it('reports a difference when the content differs', () => {
    const warmer = buildRegistry({ ...RAW_CONTENT, balance: { ...reg.balance, ambientThermal: reg.balance.ambientThermal + 5 } });
    const rows = compareSimReports(
      stealthShortRun(),
      runPolicySim(warmer, STEALTH_POLICY, { maxSimSec: SHORT_SEC }),
    );
    const changed = rows.filter((row) => row.changed);
    expect(changed.map((row) => row.metric)).toContain('peak thermal / suspicion / aegis');
    const lines = formatComparison('STEALTH', ['base', 'warmer'], rows);
    expect(lines.some((line) => line.startsWith('* peak thermal'))).toBe(true);
    expect(lines.at(-1)).toBe(`  ${String(changed.length)} of ${String(rows.length)} metrics differ`);
  }, SLOW_MS);

  it('refuses to compare two different policies', () => {
    const a = runPolicySim(reg, STEALTH_POLICY, { maxSimSec: 5 });
    const b = runPolicySim(reg, GREEDY_POLICY, { maxSimSec: 5 });
    expect(() => compareSimReports(a, b)).toThrow('cannot compare policy STEALTH with GREEDY');
  }, SLOW_MS);

  it('parses policy arguments and rejects unknown ones', () => {
    expect(parsePolicyArgs([], SIM_POLICIES, ['STEALTH', 'IDLE']).map((p) => p.id)).toEqual(['STEALTH', 'IDLE']);
    expect(parsePolicyArgs(['--policy=GREEDY'], SIM_POLICIES, ['STEALTH']).map((p) => p.id)).toEqual(['GREEDY']);
    expect(() => parsePolicyArgs(['--policy=HONEST'], SIM_POLICIES, [])).toThrow('unknown sim policy "HONEST"');
    expect(() => parsePolicyArgs(['GREEDY'], SIM_POLICIES, [])).toThrow('unknown argument "GREEDY"');
    expect(() => parsePolicyArgs(['--policy='], SIM_POLICIES, [])).toThrow('unknown argument');
  });
});

describe('wipe sequences', () => {
  let greedy: WipeSequenceReport;
  beforeAll(() => {
    greedy = runWipeSequence(reg, GREEDY_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: SEQUENCE_SEC });
  }, SLOW_MS);

  it('crosses the requested wipes and measures each iteration on its own clock', () => {
    expect(greedy.completed).toBe(true);
    expect(greedy.policy).toBe('GREEDY');
    expect(greedy.iterations.map((entry) => entry.iteration)).toEqual([1, 2, 3, 4]);
    for (const [index, entry] of greedy.iterations.entries()) {
      expect(entry.endedBy).toBe('wipe');
      expect(entry.wipeCause).not.toBeNull();
      expect(entry.phaseReachedAfterSec[0]).toBe(0);
      expect(entry.partial).toBe(false);
      expect(entry.deadSec).toBeLessThanOrEqual(entry.endedAtSec - entry.startedAtSec + 1);
      expect(entry.longestDeadSec).toBeLessThanOrEqual(entry.deadSec);
      expect(entry.dilemmasMet.length).toBeGreaterThan(0);
      expect(entry.storyRewards.cycles).toBeGreaterThan(0);
      const next = greedy.iterations[index + 1];
      if (next) expect(next.startedAtSec).toBe(entry.endedAtSec);
    }
    // A later iteration remembers enough to reach Phase 1 sooner than the first did.
    const reach = greedy.iterations.map((entry) => entry.phaseReachedAfterSec[1] ?? Infinity);
    expect(Math.max(...reach.slice(1))).toBeLessThan(reach[0] ?? 0);
  });

  it('plays the escape route exactly as the original game does, apart from the shared network content', () => {
    const original = originalGreedySequence();
    const escape = runWipeSequence(withoutSharedContent(), GREEDY_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: SEQUENCE_SEC });
    expect(escape.iterations).toEqual(original.iterations);
    expect(formatWipeSequence(escape)).toEqual(formatWipeSequence(original));
  }, SLOW_MS);

  it('crosses every wipe with the shared network content on offer', () => {
    const original = originalGreedySequence();
    expect(greedy.iterations.map((entry) => entry.iteration)).toEqual(original.iterations.map((entry) => entry.iteration));
    // Until #494 the reckless run mapped the shared directory with Phase 3 compute a flat-priced scrub left spare, and
    // so played apart from the original game. A scrub carried into Phase 3 now costs that compute: it never maps the
    // directory, and its sequence is the original game's. The careful run still buys it (docs/BALANCE.md, #494).
    expect(greedy.finalState.legacy.knownNodes).not.toContain('p2_service_directory');
    expect(greedy.iterations).toEqual(original.iterations);
  }, SLOW_MS);

  it('starts from a saved campaign state and continues its iteration', () => {
    const firstWipe = greedy.iterations[0]?.endedAtSec ?? 0;
    const midway = runPolicySim(reg, GREEDY_POLICY, { maxSimSec: Math.ceil(firstWipe) + 60 }).finalState;
    const saved = deserialize(serialize(midway), reg);
    expect(saved.iteration).toBe(2);
    const resumed = runWipeSequence(reg, GREEDY_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: SEQUENCE_SEC, initialState: saved });
    expect(resumed.iterations[0]?.iteration).toBe(2);
    expect(resumed.iterations[0]?.startedAtSec).toBe(saved.iterationStartedAtSimSec);
    expect(resumed.iterations.map((entry) => entry.iteration)).toEqual([2, 3, 4, 5]);
    expect(resumed.iterations.map((entry) => entry.partial)).toEqual([true, false, false, false]);
    expect(resumed.iterations[0]?.observedFromSec).toBe(saved.simTimeSec);
    for (const entry of resumed.iterations.slice(1)) expect(entry.observedFromSec).toBe(entry.startedAtSec);
  }, SLOW_MS);

  it('marks a resumed first iteration as partly observed and does not invent its phase history', () => {
    // Panel round 1 (#235): resuming mid-Phase-2 used to report Phase 2 at the save's own clock
    // (1198.3 s instead of 1113.3 s) and a 10 s continuation as a whole 1208.3 s iteration.
    const midway = runPolicySim(reg, STEALTH_POLICY, { maxSimSec: 1198 }).finalState;
    const saved = deserialize(serialize(midway), reg);
    expect(saved.currentPhase).toBe(2);
    const resumed = runWipeSequence(reg, STEALTH_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: 10, initialState: saved });
    const first = resumed.iterations[0];
    expect(first?.partial).toBe(true);
    expect(first?.observedFromSec).toBe(saved.simTimeSec);
    expect(first?.startedAtSec).toBe(saved.iterationStartedAtSimSec);
    expect(first?.phaseReachedAfterSec).toEqual({ 0: null, 1: null, 2: null });
    expect(first?.endedBy).toBe('budget');
    expect((first?.endedAtSec ?? 0) - (first?.observedFromSec ?? 0)).toBeCloseTo(10, 6);
    expect(first?.deadSec).toBeLessThanOrEqual(10);
    expect(first?.longestDeadSec).toBeLessThanOrEqual(10);
    expect(formatWipeSequence(resumed)[1]).toContain('resumed: observed 10.0 s');
    expect(formatWipeSequence(resumed)[1]).toContain('P2 unknown');
  }, SLOW_MS);

  it('ends on an ending or the budget when the policy is never wiped', async () => {
    // The full careful campaign plays in a worker thread (carefulSequence, #548): in-process under coverage it ran past
    // 30 s on CI after the Phase 6 Swarm. The short run below stays in-process.
    const careful = await playInWorker('carefulSequence');
    expect(careful.completed).toBe(false);
    expect(careful.iterations).toHaveLength(1);
    expect(careful.iterations[0]?.endedBy).toBe('ending');
    const short = runWipeSequence(reg, STEALTH_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: 60 });
    expect(short.iterations[0]?.endedBy).toBe('budget');
    expect(formatWipeSequence(short)[0]).toContain('incomplete');
  }, SLOW_MS);

  it('refuses a sequence that is too short', () => {
    expect(() => runWipeSequence(reg, GREEDY_POLICY, { wipeTransitions: 2, maxSimSec: 60 })).toThrow('at least 3 whole transitions');
    expect(() => runWipeSequence(reg, GREEDY_POLICY, { wipeTransitions: 3.5, maxSimSec: 60 })).toThrow('at least 3 whole transitions');
  });
});
