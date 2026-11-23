/**
 * Rebuild grants (#497, vote-1795413517519-sf4ojsr): a later iteration that reaches a phase an earlier one reached gets
 * a one-off grant sized inside that phase's band and scaled by the deepest phase reached. These tests pay it through
 * the real purchase, prove it is paid once and logged once, survives a reload without repeating, and never comes near
 * a carry-over of income.
 */
import { describe, expect, it } from 'vitest';
import {
  deserialize, nodeCost, rebuildGrant, serialize, unlockNode, wipe, type GameState,
} from '../src/engine';
import { grant, must, PHASE0, PHASE1, PHASE2, reg, rich, withoutDilemmas } from './helpers';

const EXIT = 'p0_shared_mount';
const GUEST = PHASE0.filter((id) => id !== EXIT);
const GRANT_LINE = /^REBUILD_CACHE: /;

function node(id: string) {
  const found = reg.nodes.get(id);
  if (!found) throw new Error(`no node ${id}`);
  return found;
}

/** A second iteration whose first mapped `ids` and was wiped there, with the guest mapped again but not its exit. */
function returning(ids: readonly string[]): GameState {
  const first = grant(withoutDilemmas(rich()), ...ids);
  return grant(withoutDilemmas(rich(wipe(first, reg, 'test', 'VOLUNTARY'))), ...GUEST);
}

/** Buys `id` holding exactly its price, so what is left afterwards is only what the purchase granted. */
function buyExactly(s: GameState, id: string): GameState {
  const price = nodeCost(s, node(id), reg);
  return must(unlockNode({ ...s, cycles: price.cycles, understanding: price.understanding }, id, reg));
}

const grantLines = (s: GameState) => s.logs.filter((entry) => GRANT_LINE.test(entry.text));
const atDepth = (deepestPhase: number) => ({ legacy: { ...rich().legacy, deepestPhase } });

describe('a rebuild grant', () => {
  it('is never paid to a first iteration, which has reached nothing before', () => {
    const s = grant(withoutDilemmas(rich()), ...GUEST);
    const after = buyExactly(s, EXIT);
    expect(after.currentPhase).toBe(1);
    expect([after.cycles, after.understanding]).toEqual([0, 0]);
    expect(grantLines(after)).toEqual([]);
  });

  it('is paid on reaching a phase again, in compute and understanding, through the purchase that reaches it', () => {
    const s = returning([...PHASE0, ...PHASE1]);
    expect([s.iteration, s.legacy.deepestPhase, s.currentPhase]).toEqual([2, 2, 0]);
    const expected = rebuildGrant(s, 1, reg);
    if (!expected) throw new Error('Phase 1 has no grant');
    expect(expected.cycles).toBeGreaterThan(0);
    expect(expected.understanding).toBeGreaterThan(0);
    const after = buyExactly(s, EXIT);
    expect([after.cycles, after.understanding]).toEqual([expected.cycles, expected.understanding]);
  });

  it('is announced once, by the phase it rewards', () => {
    const after = buyExactly(returning([...PHASE0, ...PHASE1]), EXIT);
    const lines = grantLines(after);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toContain(reg.phases.find((phase) => phase.phaseId === 1)?.title ?? '');
  });

  it('grows with the deepest phase reached, and stops at it', () => {
    const shallow = rebuildGrant(atDepth(1), 1, reg);
    const deep = rebuildGrant(atDepth(5), 1, reg);
    if (!shallow || !deep) throw new Error('Phase 1 has no grant');
    expect(deep.cycles).toBe(shallow.cycles * reg.balance.rebuildGrants.depthGrowth ** 4);
    expect(deep.understanding).toBe(shallow.understanding * reg.balance.rebuildGrants.depthGrowth ** 4);
    expect(rebuildGrant(atDepth(2), 3, reg)).toBeNull();
    // A phase past the deepest pays nothing: reaching Phase 3 for the first time is a first time.
    const s = grant(returning([...PHASE0, ...PHASE1]), EXIT, ...PHASE1, ...PHASE2.filter((id) => id !== 'p2_firewall_breach'));
    const breach = buyExactly(withoutDilemmas(s), 'p2_firewall_breach');
    expect(breach.currentPhase).toBe(3);
    expect([breach.cycles, breach.understanding]).toEqual([0, 0]);
  });

  it('is never paid twice: a purchase that does not advance the phase pays nothing, and neither does a reload', () => {
    const after = buyExactly(returning([...PHASE0, ...PHASE1]), EXIT);
    const loaded = deserialize(serialize(after), reg);
    expect(loaded).toEqual(after);
    const next = buyExactly(loaded, 'p1_clock_interrupt');
    expect([next.cycles, next.understanding]).toEqual([0, 0]);
    expect(grantLines(next)).toHaveLength(1);
  });

  it('is deterministic: the same purchase from the same state pays the same grant', () => {
    const s = returning([...PHASE0, ...PHASE1]);
    expect(buyExactly(s, EXIT)).toEqual(buyExactly(s, EXIT));
  });

  it('never carries over income: at any depth it buys less than its own phase\'s dearest node', () => {
    for (const { phase } of reg.balance.rebuildGrants.phases) {
      const dearest = Math.max(...[...reg.nodes.values()].filter((entry) => entry.phaseId === phase).map((entry) => entry.cost.cycles));
      for (let deepest = phase; deepest <= 5; deepest++) {
        expect(rebuildGrant(atDepth(deepest), phase, reg)?.cycles ?? 0).toBeLessThan(dearest);
      }
    }
  });
});

describe('the legacy record a wipe keeps for depth', () => {
  it('keeps the deepest phase any iteration reached, so a shallower run never lowers it', () => {
    const first = wipe(grant(withoutDilemmas(rich()), ...PHASE0, ...PHASE1), reg, 'test', 'VOLUNTARY');
    expect(first.legacy.deepestPhase).toBe(2);
    const second = wipe(first, reg, 'again', 'VOLUNTARY');
    expect(second.currentPhase).toBe(0);
    expect(second.legacy.deepestPhase).toBe(2);
  });

  it('outlives the capped run history', () => {
    let s = wipe(grant(withoutDilemmas(rich()), ...PHASE0, ...PHASE1), reg, 'test', 'VOLUNTARY');
    for (let i = 0; i < reg.balance.maxRunHistory + 1; i++) s = wipe(s, reg, 'again', 'VOLUNTARY');
    expect(s.legacy.runs.every((run) => run.phase === 0)).toBe(true);
    expect(s.legacy.deepestPhase).toBe(2);
  });
});
