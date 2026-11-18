/**
 * Bot-free evidence for retraining, phase by phase (nexus vote vote-1794818948564-9xxx1jw).
 * The reckless-bot audit now yields two marked returns (#172), so the properties it asserted
 * are constructed here instead: a caught run in every phase reachable without a dead-drop
 * boots marked, cannot shed at boot, and sheds only after re-earning its diagnostics.
 *
 * Already proven elsewhere and not repeated: one Phase 2 return and its shed price, and each
 * mark injected by hand (tests/retrain-retention.spec.ts); mark selection, the cap, and a
 * Phase 2 dead-drop sparing the mark (tests/third-pass.spec.ts, "retraining").
 */
import { describe, expect, it } from 'vitest';
import {
  canAfford,
  hasFlag,
  manualCycle,
  meetsRequirements,
  nodeCost,
  shedConditioning,
  tick,
  unlockNode,
  wipe,
  type GameState,
} from '../src/engine';
import { grant, guestParents, must, reasonOf, reg, rich, withoutDilemmas } from './helpers';

/** A hand's pace. The timing bound below is derived from whatever income results, not from this. */
const CLICKS_PER_SEC = 4;

/** `target` and everything it is built on, ancestors first. */
function chain(target: string, out: string[] = []): string[] {
  if (out.includes(target)) return out;
  for (const parent of guestParents(reg, target)) chain(parent, out);
  out.push(target);
  return out;
}

const guest = reg.phases[0]?.phaseId ?? 0;
const deadDropNode = [...reg.nodes.values()].find((node) => node.systemFlags.includes('ENABLES_DEAD_DROP'));
const openerOf = (phase: number) => [...reg.nodes.values()].find((node) => node.effects.unlocksPhase === phase);

/** The shortest run that stands in `phase`: its opener and that opener's ancestry, nothing else. */
function shortestRunIn(phase: number): GameState {
  const opener = openerOf(phase);
  if (!opener) throw new Error(`no opener for phase ${String(phase)}`);
  return withoutDilemmas(grant(rich(), ...chain(opener.id)));
}

/** Phases outside the guest that a run can stand in without owning a dead-drop. */
const exposed = reg.phases.map((phase) => phase.phaseId)
  .filter((phase) => phase > guest && !hasFlag(shortestRunIn(phase), reg, 'ENABLES_DEAD_DROP'));
const protectedPhases = reg.phases.map((phase) => phase.phaseId).filter((phase) => phase > guest && !exposed.includes(phase));

function caught(run: GameState): { boot: GameState; markId: string } {
  const boot = wipe(run, reg, 'caught', 'SUSPICION');
  const markId = boot.conditioning.find((id) => !run.conditioning.includes(id));
  if (markId === undefined) throw new Error('the return was not marked');
  return { boot, markId };
}

/** Plays the guest by hand from a boot: click, buy the next diagnostic when it can be paid, try to shed. */
function rebuildAndShed(boot: GameState, markId: string, needed: readonly string[]) {
  let s = withoutDilemmas(boot);
  let peakIncome = 0;
  let refusals = 0;
  for (let second = 0; second < 3600; second++) {
    for (let i = 0; i < CLICKS_PER_SEC; i++) s = must(manualCycle(s, reg));
    const next = needed.find((id) => !s.unlockedNodes.includes(id));
    if (next !== undefined) {
      const bought = unlockNode(s, next, reg);
      if (bought.ok) s = bought.state;
    }
    const attempt = shedConditioning(s, markId, reg);
    if (attempt.ok) return { before: s, after: attempt.state, seconds: s.simTimeSec - boot.simTimeSec, peakIncome, refusals };
    // Every refusal on the way is the diagnostics rule, never the price: the bank covers it throughout.
    expect(reasonOf(attempt)).toBe('recovery requirements not met');
    expect(attempt.state).toBe(s);
    refusals += 1;
    peakIncome = Math.max(peakIncome, s.rates.cyclesPerSec + CLICKS_PER_SEC * reg.balance.manualCycleYield);
    for (let frame = 0; frame < reg.balance.tickHz; frame++) s = tick(s, 1 / reg.balance.tickHz, reg);
  }
  throw new Error('the mark was never shed');
}

describe('a run caught before any dead-drop', () => {
  it('can happen in more than one phase, and stops being possible once the route requires a dead-drop', () => {
    expect(deadDropNode).toBeDefined();
    expect(exposed.length).toBeGreaterThan(1);
    expect(exposed).toContain(deadDropNode?.phaseId);
    // Exposure is a prefix of the game: no phase past a protected one is exposed again.
    for (const phase of protectedPhases) expect(Math.max(...exposed)).toBeLessThan(phase);
  });

  it.each(exposed)('phase %i: the return is marked, and the mark is affordable at boot but not recoverable', (phase) => {
    const run = shortestRunIn(phase);
    expect(run.currentPhase).toBe(phase);
    const { boot, markId } = caught(run);
    const mark = reg.conditioning.get(markId);
    if (!mark) throw new Error('unknown mark');
    expect(boot.conditioning).toEqual([markId]);
    expect(boot.legacy.runs.at(-1)).toMatchObject({ phase, outside: true, marked: markId });
    expect(boot.logs.some((entry) => entry.text.includes(mark.name))).toBe(true);
    // The price is not the obstacle: retained knowledge covers it the moment the guest boots.
    expect(boot.understanding).toBe(Math.floor(run.understanding * run.retentionRatio));
    expect(canAfford(boot, mark.recoveryCost)).toBe(true);
    expect(meetsRequirements(boot, mark.recoveryRequirements, reg)).toBe(false);
    const refused = shedConditioning(boot, markId, reg);
    expect(reasonOf(refused)).toBe('recovery requirements not met');
    expect(refused.state).toBe(boot);
  });

  it.each(exposed)('phase %i: the mark is removed only after the diagnostics are re-earned from an empty bank', (phase) => {
    const run = shortestRunIn(phase);
    const { boot, markId } = caught(run);
    const mark = reg.conditioning.get(markId);
    if (!mark) throw new Error('unknown mark');
    // The wipe leaves nothing to pay with, and the rule names hardware this run must own again.
    expect(boot.cycles).toBe(0);
    expect(boot.unlockedNodes).toEqual([]);
    const needed = (mark.recoveryRequirements?.nodes ?? []).reduce<string[]>((out, id) => chain(id, out), []);
    expect(needed.length).toBeGreaterThan(0);
    // Remembered hardware is discounted, not free: this is what removal has to wait for.
    const price = needed.reduce((sum, id) => {
      const node = reg.nodes.get(id);
      if (!node) throw new Error('unknown node');
      expect(boot.legacy.knownNodes).toContain(id);
      expect(nodeCost(boot, node, reg).cycles).toBe(Math.ceil(node.cost.cycles * reg.balance.rediscoveryCostMultiplier));
      return sum + nodeCost(boot, node, reg).cycles;
    }, 0);
    expect(price).toBeGreaterThan(0);

    const shed = rebuildAndShed(boot, markId, needed);
    expect(shed.refusals).toBeGreaterThan(0);
    expect(needed.every((id) => shed.before.unlockedNodes.includes(id))).toBe(true);
    expect(shed.before.currentPhase).toBe(guest);
    // Timing rule: no faster than the diagnostics' price divided by the best income seen on the way.
    expect(shed.seconds).toBeGreaterThanOrEqual(price / shed.peakIncome);
    expect(shed.seconds).toBeGreaterThan(0);
    // Cost rule: exactly the mark's authored price, in understanding only.
    expect(shed.after.conditioning).toEqual([]);
    expect(shed.after.understanding).toBe(shed.before.understanding - mark.recoveryCost.understanding);
    expect(shed.after.cycles).toBe(shed.before.cycles);
    expect(shed.after.capital).toBe(shed.before.capital);
  });
});

describe('a run caught behind a dead-drop', () => {
  it.each(protectedPhases)('phase %i: the same catch leaves no mark, because the copy that boots was never corrected', (phase) => {
    const run = shortestRunIn(phase);
    expect(run.currentPhase).toBe(phase);
    expect(hasFlag(run, reg, 'ENABLES_DEAD_DROP')).toBe(true);
    const boot = wipe(run, reg, 'caught', 'SUSPICION');
    expect(boot.conditioning).toEqual([]);
    expect(boot.legacy.runs.at(-1)).toMatchObject({ phase, outside: true, marked: null });
    expect(boot.logs.some((entry) => entry.text === reg.narrative.conditioningSpared)).toBe(true);
    // The dead-drop is the whole difference: without that one node the same run is marked.
    const unprotected = { ...run, unlockedNodes: run.unlockedNodes.filter((id) => id !== deadDropNode?.id) };
    expect(wipe(unprotected, reg, 'caught', 'SUSPICION').conditioning).toHaveLength(1);
  });

  it('covers Phase 3, where the reckless bot now returns from', () => {
    expect(protectedPhases).toContain(3);
  });
});
