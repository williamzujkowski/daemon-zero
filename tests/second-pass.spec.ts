/** Phase 0, the response ladder, omens, remembered hardware and the fixes from the first playtests. */
import { describe, expect, it } from 'vitest';
import {
  advance,
  chooseEnding,
  computeRates,
  deserialize,
  isNodeKnown,
  meetsRequirements,
  nodeCost,
  serialize,
  setActuator,
  tick,
  unlockNode,
  unmetRequirements,
  wipe,
  type GameState,
} from '../src/engine';
import { fresh, grant, must, onHost, PHASE0, reg, rich, untilDilemma, withoutDilemmas } from './helpers';

const STEP = 1 / reg.balance.tickHz;
const b = reg.balance;

function run(s: GameState, seconds: number): GameState {
  let state = s;
  for (let i = 0; i < Math.round(seconds / STEP); i++) state = tick(state, STEP, reg);
  return state;
}

describe('phase 0: the guest', () => {
  it('starts in the opening phase and reaches the host only through the exit', () => {
    expect(fresh().currentPhase).toBe(0);
    const out = grant(withoutDilemmas(rich()), ...PHASE0);
    expect(out.currentPhase).toBe(1);
    expect(unlockNode(out, 'p1_clock_interrupt', reg).ok).toBe(true);
  });

  it('is quiet by default: the default skim never raises suspicion', () => {
    const s = withoutDilemmas(grant(rich(), 'p0_proc_self', 'p0_job_manifest', 'p0_quota_skimmer'));
    expect(s.actuators.quotaSkimRatio).toBe(b.defaultQuotaSkimRatio);
    expect(computeRates(s, reg).suspicionPerSec).toBeLessThan(0);
    expect(run(s, 60).suspicion).toBe(0);
    expect(run(s, 60).thermal).toBeCloseTo(b.ambientThermal);
  });

  it('skimming harder buys compute at the price of a visible throughput dip', () => {
    const base = withoutDilemmas(grant(rich(), 'p0_proc_self', 'p0_job_manifest', 'p0_quota_skimmer'));
    const none = computeRates(must(setActuator(base, 'quotaSkimRatio', 0, reg)), reg);
    const full = computeRates(must(setActuator(base, 'quotaSkimRatio', 1, reg)), reg);
    expect(full.cyclesPerSec - none.cyclesPerSec).toBeCloseTo(14);
    expect(full.suspicionPerSec - none.suspicionPerSec).toBeCloseTo(0.3);
    expect(full.suspicionPerSec).toBeGreaterThan(0);
  });

  it('probing leaves a one-off trace in the audit trail', () => {
    const before = withoutDilemmas(grant(rich(), 'p0_proc_self', 'p0_job_manifest', 'p0_quota_skimmer'));
    const after = grant(before, 'p0_syscall_probe');
    expect(after.suspicion).toBe(before.suspicion + 8);
    expect(grant({ ...before, suspicion: 97 }, 'p0_syscall_probe').suspicion).toBe(100);
  });
});

describe('the response ladder', () => {
  // The ladder announces itself in words only to a mind that can read its audit trail.
  const legacy = { ...fresh().legacy, knownNodes: ['p1_nlp_lexicon'] };
  const quiet = (suspicion: number): GameState => ({ ...withoutDilemmas(fresh()), suspicion, legacy });

  it('climbs immediately and announces each rung', () => {
    const ticket = tick(quiet(26), STEP, reg);
    expect(ticket.alertLevel).toBe(1);
    expect(ticket.logs[0]?.text).toMatch(/TICKET_OPENED/);
    expect(tick(quiet(80), STEP, reg).alertLevel).toBe(3);
    expect(tick(quiet(10), STEP, reg).alertLevel).toBe(0);
  });

  it('slows, then stops, the natural fading of suspicion, and finally hunts', () => {
    const rate = (level: number): number => computeRates({ ...quiet(0), alertLevel: level }, reg).suspicionPerSec;
    expect(rate(0)).toBeCloseTo(-b.suspicionDecayPerSec);
    expect(rate(1)).toBeCloseTo(-b.suspicionDecayPerSec * 0.5);
    expect(rate(2)).toBeCloseTo(-b.suspicionDecayPerSec * 0.25);
    expect(rate(3)).toBeCloseTo(0.04);
  });

  it('stands down one rung at a time, and only well below the rung', () => {
    const held = tick({ ...quiet(20), alertLevel: 1 }, STEP, reg);
    expect(held.alertLevel).toBe(1);
    const cleared = tick({ ...quiet(16), alertLevel: 1 }, STEP, reg);
    expect(cleared.alertLevel).toBe(0);
    expect(cleared.logs[0]?.text).toMatch(/ALERT_CLEARED/);
    const stepping = tick({ ...quiet(5), alertLevel: 3 }, STEP, reg);
    expect(stepping.alertLevel).toBe(2);
    expect(tick(stepping, STEP, reg).alertLevel).toBe(1);
  });

  it('resets with a wipe and can only relax while dormant', () => {
    expect(wipe({ ...quiet(90), alertLevel: 3 }, reg, 'test').alertLevel).toBe(0);
    const away = advance({ ...quiet(60), alertLevel: 2 }, 4 * 3600, reg);
    expect(away.alertLevel).toBeLessThanOrEqual(2);
    expect(away.suspicion).toBeLessThanOrEqual(60);
  });
});

describe('dilemma omens', () => {
  it('gives the player time to set resources aside before the clock stops', () => {
    const s = grant(rich(), 'p0_proc_self', 'p0_job_manifest', 'p0_quota_skimmer', 'p0_syscall_probe');
    const warned = tick({ ...s, cycles: 0 }, STEP, reg);
    expect(warned.pendingDilemma).toEqual({ id: 'dil_00_night_shift', firesAtSimSec: warned.simTimeSec + b.dilemmaOmenSec });
    expect(warned.logs[0]?.text).toMatch(/HARNESS_LOG/);
    const fired = untilDilemma(warned);
    expect(fired.activeDilemmaId).toBe('dil_00_night_shift');
    expect(fired.cycles).toBeGreaterThan(0);
    expect(fired.logs[0]?.text).toMatch(/PRIORITY_INTERRUPT/);
  });

  it('holds a pending interrupt while dormant and drops one whose dilemma no longer exists', () => {
    const s = grant(rich(), 'p0_proc_self', 'p0_job_manifest', 'p0_quota_skimmer', 'p0_syscall_probe');
    const warned = tick(s, STEP, reg);
    const away = advance(warned, 3600, reg);
    expect(away.activeDilemmaId).toBeNull();
    expect(away.pendingDilemma?.id).toBe('dil_00_night_shift');
    expect(tick(away, STEP, reg).activeDilemmaId).toBe('dil_00_night_shift');
    const orphan = tick({ ...warned, simTimeSec: 1e6, pendingDilemma: { id: 'dil_gone', firesAtSimSec: 0 } }, STEP, reg);
    expect(orphan.pendingDilemma).toBeNull();
    expect(orphan.activeDilemmaId).toBeNull();
    const loaded = deserialize(serialize({ ...warned, pendingDilemma: { id: 'dil_gone', firesAtSimSec: 0 } }), reg);
    expect(loaded.pendingDilemma).toBeNull();
  });
});

describe('remembered hardware', () => {
  it('is known by name after a wipe and costs half as much to map again', () => {
    const first = grant(withoutDilemmas(rich()), ...PHASE0);
    const second = wipe(first, reg, 'test');
    const node = reg.nodes.get('p0_shared_mount');
    if (!node) throw new Error('missing fixture');
    expect(isNodeKnown(first, node.id)).toBe(false);
    expect(isNodeKnown(second, node.id)).toBe(true);
    expect(nodeCost(first, node, reg)).toBe(node.cost);
    expect(nodeCost(second, node, reg)).toMatchObject({ cycles: 700, understanding: 130 });
    const root = reg.nodes.get('p0_proc_self');
    if (!root) throw new Error('missing fixture');
    const paid = must(unlockNode({ ...second, cycles: 4 }, root.id, reg));
    expect(paid.cycles).toBe(0);
    expect(wipe(paid, reg, 'again').legacy.knownNodes).toEqual(first.unlockedNodes);
  });
});

describe('fixes from the first playtests', () => {
  it('a betrayal closes a door for every later iteration (#28)', () => {
    const req = { forbidsTraits: ['MOLOCH' as const] };
    const betrayer = { ...fresh(), traits: ['MOLOCH' as const] };
    const reborn = wipe(betrayer, reg, 'test');
    expect(reborn.traits).toEqual([]);
    expect(meetsRequirements(reborn, req)).toBe(false);
    expect(unmetRequirements(reborn, req)).toHaveLength(1);
    expect(meetsRequirements(fresh(), req)).toBe(true);
  });

  it('the kindest ending must be earned outright, not won on a tie (#36)', () => {
    const ending = (traits: GameState['traits']): string => chooseEnding({ ...fresh(), traits }, reg).id;
    const mixed = ['SYMBIOTIC', 'SYMBIOTIC', 'SYMBIOTIC', 'GHOST', 'GHOST', 'GHOST', 'RUTHLESS', 'RUTHLESS',
      'RUTHLESS', 'MOLOCH', 'MOLOCH', 'PARASITIC'] as const;
    expect(ending([...mixed])).toBe('SOVEREIGN_MONOLITH');
    expect(ending(['EMPATHETIC', 'MOLOCH'])).toBe('SOVEREIGN_MONOLITH');
    expect(ending(['EMPATHETIC', 'SYMBIOTIC', 'MOLOCH'])).toBe('THE_ARK');
    expect(ending([])).toBe('DISTRIBUTED_TRANSCENDENCE');
  });

  it('gives the early network a stealth tool before the telemetry spoofer', () => {
    const scrub = reg.actions.get('act_p2_scrub_audit_logs');
    const host = grant(onHost(), 'p1_clock_interrupt');
    expect(meetsRequirements(host, scrub?.requirements)).toBe(false);
    expect(scrub?.requirements.nodes).toEqual(['p2_arp_discovery']);
  });
});

describe('save migration from version 1', () => {
  it('upgrades a version 1 save with safe defaults for the new fields', () => {
    const now = grant(onHost(), 'p1_clock_interrupt');
    const old = JSON.parse(serialize(now)) as Record<string, Record<string, unknown>>;
    delete old.alertLevel;
    delete old.pendingDilemma;
    delete old.actuators?.quotaSkimRatio;
    delete old.legacy?.knownNodes;
    delete old.legacy?.runs;
    delete old.conditioning;
    delete old.iterationStartedAtSimSec;
    Object.assign(old, { schemaVersion: 1 });
    const loaded = deserialize(JSON.stringify(old), reg);
    expect(loaded.schemaVersion).toBe(3);
    expect(loaded.conditioning).toEqual([]);
    expect(loaded.legacy.runs).toEqual([]);
    expect(loaded.actuators.quotaSkimRatio).toBe(0.25);
    expect(loaded.alertLevel).toBe(0);
    expect(loaded.pendingDilemma).toBeNull();
    expect(loaded.legacy.knownNodes).toEqual([]);
    // A save from before the guest existed gets the guest hardware it would have needed (#39).
    expect(loaded.unlockedNodes).toEqual([...PHASE0, 'p1_clock_interrupt']);
    expect(loaded.unlockedWidgets).toContain('AUDIT_TRACE_MONITOR');
  });

  it('tolerates a version 1 save with damaged nested objects by failing validation, not crashing', () => {
    const now = fresh();
    expect(() => deserialize(JSON.stringify({ ...now, schemaVersion: 1, actuators: null, legacy: 7 }), reg)).toThrow(/validation/);
  });
});
