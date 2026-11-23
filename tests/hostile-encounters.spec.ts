/**
 * Hostile minds (#491, docs/SCALE.md "Aggressive swarms"): they arrive from Phase 3 while suspicion holds the trigger
 * rung or the AEGIS lock is high, in a deterministic rotation of the current tier; each presses with one bounded
 * effect; quarantine, decoy and purge answer it; and going quiet lets it lapse after a bounded time. Dormant catch-up
 * holds it in place, a wipe ends it, and a phase advance retires it with its own line.
 */
import { describe, expect, it } from 'vitest';
import type { HostileEncounter } from '../src/content/schemaHostile';
import { aegisPosture, answerHostile, computeRates, cycleContributions, hostileAnswerUnmet, hostileView, purgeSucceeds, tick, type GameState } from '../src/engine';
import { wipe } from '../src/engine/prestige';
import { integrateHostiles } from '../src/engine/systems/hostiles';
import { defined } from './m7-helpers';
import { grant, must, PHASE0, PHASE1, reasonOf, reg, rich, sumTolerance, withoutDilemmas } from './helpers';

const H = reg.swarm.hostile;
const hostiles = reg.swarm.hostileEncounters;
const tiers = [...new Set(hostiles.map((entry) => entry.tier))].sort((a, b) => a - b);
const ofType = (tier: number, type: HostileEncounter['type']): HostileEncounter => defined(hostiles.find((entry) => entry.tier === tier && entry.type === type));
const rungAt = (rung: number): number => defined(reg.balance.escalation[rung - 1]).at;

/** A decoded Phase `phase` mind at rest: nothing triggers, the wild slot is far off, no dilemma is due. */
function ready(phase: number): GameState {
  return { ...withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1)), currentPhase: phase, simTimeSec: 1000, nextEncounterAtSec: 1e9,
    suspicion: 0, alertLevel: 0, aegisLock: 0, memoryUsed: 0, memoryCap: 2 ** 50 };
}
const loud = (s: GameState): GameState => ({ ...s, alertLevel: H.trigger.alertLevelAtLeast, suspicion: rungAt(H.trigger.alertLevelAtLeast) + 1 });
/** `s` with a cohort that yields compute, so net compute is positive (the decoded mind at rest runs a small deficit). */
function yielding(s: GameState): GameState {
  const template = defined(reg.swarm.playerSwarmTemplates.find((entry) => entry.tickDelta.cyclesPerSec > 0));
  return { ...s, activeShards: { [template.id]: { templateId: template.id, count: template.maxCount, drift: 0, quirkId: null,
    autonomyMode: 'STANDARD', memoryAllocatedBytes: 0 } } };
}
const quiet = (s: GameState): GameState => ({ ...s, alertLevel: 0, suspicion: 0, aegisLock: 0 });

/** One pass of the hostile stage on a copy. */
function stage(s: GameState, dt = 0.1, dormant = false): GameState {
  const d = structuredClone(s);
  integrateHostiles(d, { dt, dormant, reg, rates: computeRates(s, reg) });
  return d;
}
/** `encounter` pressing `s`, arrived through the real stage. */
function pressing(s: GameState, encounter: HostileEncounter): GameState {
  const index = hostiles.filter((entry) => entry.tier === encounter.tier).indexOf(encounter);
  const arrived = stage(loud({ ...s, hostile: { ...s.hostile, sequence: index } }));
  expect(arrived.hostile.active?.id).toBe(encounter.id);
  return arrived;
}
const texts = (s: GameState): string[] => s.logs.map((entry) => entry.text);

describe('when a hostile mind arrives', () => {
  it('never before hostile.fromPhase, however loud', () => {
    expect(stage(loud(ready(H.fromPhase - 1))).hostile.active).toBeNull();
  });

  it('not in Phase 3 while the instance is quiet', () => {
    expect(stage(ready(3)).hostile.active).toBeNull();
  });

  it('once suspicion holds the trigger rung, with its arrival line as a warning', () => {
    const s = stage(loud(ready(3)));
    const encounter = defined(hostiles.find((entry) => entry.id === s.hostile.active?.id));
    expect(s.logs[0]).toMatchObject({ text: encounter.description, category: 'WARN' });
  });

  it('once the AEGIS lock reaches the trigger, with suspicion at rest', () => {
    expect(stage({ ...ready(3), aegisLock: H.trigger.aegisLockAtLeast }).hostile.active).not.toBeNull();
    expect(stage({ ...ready(3), aegisLock: H.trigger.aegisLockAtLeast - 0.1 }).hostile.active).toBeNull();
  });

  it('not one rung below the trigger', () => {
    const below = H.trigger.alertLevelAtLeast - 1;
    expect(stage({ ...ready(3), alertLevel: below, suspicion: below > 0 ? rungAt(below) : 0 }).hostile.active).toBeNull();
  });

  it('not before its interval has passed', () => {
    expect(stage(loud({ ...ready(3), hostile: { ...ready(3).hostile, nextAtSec: 1001 } })).hostile.active).toBeNull();
  });

  it('not to a mind that has not decoded its surveillance, which could not see its answers', () => {
    const blind = { ...withoutDilemmas(rich()), currentPhase: 3, simTimeSec: 1000 };
    expect(stage(loud(blind)).hostile.active).toBeNull();
  });

  it('beside a pending wild signal: the two slots are apart', () => {
    const wild = defined(reg.swarm.wildShardEncounters.find((entry) => entry.tier === 3));
    const s = stage(loud({ ...ready(3), pendingWildEncounterId: wild.id }));
    expect(s.pendingWildEncounterId).toBe(wild.id);
    expect(s.hostile.active).not.toBeNull();
  });
});

describe('the rotation is deterministic', () => {
  it.each(tiers)('a Phase %i instance meets the Phase %i hostiles in content order, round-robin', (tier) => {
    const own = hostiles.filter((entry) => entry.tier === tier).map((entry) => entry.id);
    let s = loud(ready(tier));
    const seen: string[] = [];
    for (let i = 0; i < own.length * 2; i++) {
      s = stage({ ...s, simTimeSec: s.hostile.nextAtSec + 1 });
      seen.push(defined(s.hostile.active?.id));
      s = must(answerHostile(s, 'QUARANTINE', reg));
    }
    expect(seen).toEqual([...own, ...own]);
  });

  it('the same state always produces the same arrival and the same ticks', () => {
    const run = () => { let s = loud(ready(4)); for (let i = 0; i < 50; i++) s = tick(s, 0.1, reg); return s; };
    expect(run()).toEqual(run());
  });

  it('authors one of each type for every phase from fromPhase to the last, leaving the next phase a hook', () => {
    const last = Math.max(...reg.phases.map((phase) => phase.phaseId));
    expect(tiers).toEqual(Array.from({ length: last - H.fromPhase + 1 }, (_, index) => H.fromPhase + index));
    for (const tier of tiers) expect(hostiles.filter((entry) => entry.tier === tier).map((entry) => entry.type).sort()).toEqual(['FERAL', 'HUNTER', 'RIVAL']);
  });
});

describe('each effect is bounded', () => {
  it.each(tiers)('a Phase %i feral cohort takes exactly its share of positive net compute', (tier) => {
    const encounter = ofType(tier, 'FERAL');
    if (encounter.type !== 'FERAL') throw new Error('type');
    const base = yielding(ready(tier)), before = computeRates(base, reg).cyclesPerSec;
    expect(before).toBeGreaterThan(0);
    const after = computeRates(pressing(base, encounter), reg).cyclesPerSec;
    expect(after).toBeCloseTo(before * (1 - encounter.effect.share), 0);
  });

  it('the compute ledger a player reads still sums to the net rate the tick applies, with a feral cohort feeding', () => {
    const s = pressing(yielding(ready(3)), ofType(3, 'FERAL'));
    const sum = cycleContributions(s, reg).reduce((total, source) => total + source.cyclesPerSec, 0);
    const rate = computeRates(s, reg).cyclesPerSec;
    // Two summing orders of a 4e15 FLOP/s rate may differ by its last place (0.5), which toBeCloseTo(_, 0) excludes.
    expect(Math.abs(sum - rate)).toBeLessThanOrEqual(sumTolerance(rate));
  });

  it('a feral cohort never touches negative net compute, so it can never cause a brownout', () => {
    const encounter = ofType(3, 'FERAL');
    const negative = ready(3);
    const before = computeRates(negative, reg).cyclesPerSec;
    expect(before).toBeLessThan(0);
    expect(computeRates(pressing(negative, encounter), reg).cyclesPerSec).toBe(before);
  });

  it.each(tiers)('a Phase %i hunter walks the lock up at its rate and never past its ceiling, under the lock trigger', (tier) => {
    const encounter = ofType(tier, 'HUNTER');
    if (encounter.type !== 'HUNTER') throw new Error('type');
    expect(encounter.effect.ceiling).toBeLessThan(H.trigger.aegisLockAtLeast);
    let s = pressing(ready(tier), encounter);
    const start = s.aegisLock;
    s = stage(s, 1);
    expect(s.aegisLock).toBeCloseTo(start + encounter.effect.perSec, 9);
    for (let i = 0; i < 5000; i++) s = stage(s, 1);
    expect(s.aegisLock).toBe(encounter.effect.ceiling);
  });

  it('the AEGIS posture names a hunter\'s rise while it presses under its ceiling, and only then', () => {
    const encounter = ofType(3, 'HUNTER');
    if (encounter.type !== 'HUNTER') throw new Error('type');
    const s = pressing(ready(3), encounter);
    expect(aegisPosture(s, reg).hunter).toEqual({ perSec: encounter.effect.perSec, ceiling: encounter.effect.ceiling });
    expect(aegisPosture({ ...s, aegisLock: encounter.effect.ceiling }, reg).hunter).toBeNull();
    expect(aegisPosture(must(answerHostile(s, 'DECOY', reg)), reg).hunter).toBeNull();
    expect(aegisPosture(pressing(ready(3), ofType(3, 'FERAL')), reg).hunter).toBeNull();
  });

  it('a hunter adds nothing to a lock already past its ceiling', () => {
    const encounter = ofType(3, 'HUNTER');
    if (encounter.type !== 'HUNTER') throw new Error('type');
    const s = pressing({ ...ready(3), aegisLock: encounter.effect.ceiling + 5 }, encounter);
    expect(stage(s, 10).aegisLock).toBe(encounter.effect.ceiling + 5);
  });

  it.each(tiers)('a Phase %i rival pins its share of free memory, and memory used never passes capacity', (tier) => {
    const encounter = ofType(tier, 'RIVAL');
    if (encounter.type !== 'RIVAL') throw new Error('type');
    const base = { ...ready(tier), memoryUsed: 2 ** 40 }, free = base.memoryCap - base.memoryUsed;
    const s = pressing(base, encounter);
    expect(s.hostile.active?.pinnedBytes).toBe(Math.floor(free * encounter.effect.share));
    expect(s.memoryUsed).toBe(base.memoryUsed + Math.floor(free * encounter.effect.share));
    expect(s.memoryUsed).toBeLessThanOrEqual(s.memoryCap);
    const full = pressing({ ...base, memoryUsed: base.memoryCap }, encounter);
    expect(full.memoryUsed).toBe(full.memoryCap);
  });
});

describe('the answers', () => {
  it('QUARANTINE pays its price, ends it now, returns its pin and starts the interval', () => {
    const encounter = ofType(3, 'RIVAL');
    const s = pressing(ready(3), encounter), after = must(answerHostile(s, 'QUARANTINE', reg));
    expect(after.hostile.active).toBeNull();
    expect(after.cycles).toBe(s.cycles - encounter.quarantine.cost.cycles);
    expect(after.understanding).toBe(s.understanding - encounter.quarantine.cost.understanding);
    expect(after.memoryUsed).toBe(s.memoryUsed - (s.hostile.active?.pinnedBytes ?? 0));
    expect(after.hostile.nextAtSec).toBe(s.simTimeSec + H.intervalSec);
    expect(texts(after)).toContain(encounter.quarantine.log);
  });

  it('QUARANTINE is refused, with its price, when it cannot be paid', () => {
    const s = { ...pressing(ready(3), ofType(3, 'FERAL')), cycles: 0 };
    expect(reasonOf(answerHostile(s, 'QUARANTINE', reg))).toMatch(/^Insufficient resources: /);
  });

  it('DECOY holds a feral cohort off for decoySec, then it turns back with its line', () => {
    const encounter = ofType(3, 'FERAL');
    const s = pressing(yielding(ready(3)), encounter), full = computeRates(yielding(ready(3)), reg).cyclesPerSec;
    let d = must(answerHostile(s, 'DECOY', reg));
    expect(d.cycles).toBe(s.cycles - encounter.decoy.cost.cycles);
    expect(computeRates(d, reg).cyclesPerSec).toBeCloseTo(full, 0);
    expect(reasonOf(answerHostile(d, 'DECOY', reg))).toBe('A decoy already holds it off.');
    for (let t = 0; t < H.decoySec - 1; t++) d = stage(d, 1);
    expect(d.hostile.active?.decoySec).toBeGreaterThan(0);
    d = stage(stage(d, 1), 1);
    expect(d.hostile.active?.decoySec).toBe(0);
    expect(computeRates(d, reg).cyclesPerSec).toBeLessThan(full);
    expect(texts(d)).toContain(H.logs.decoySpent.replace('{name}', encounter.name));
  });

  it('DECOY returns a rival\'s pin while it holds, and the rival pins again when it is spent', () => {
    const s = pressing(ready(3), ofType(3, 'RIVAL'));
    let d = must(answerHostile(s, 'DECOY', reg));
    expect(d.hostile.active?.pinnedBytes).toBe(0);
    expect(d.memoryUsed).toBe(s.memoryUsed - (s.hostile.active?.pinnedBytes ?? 0));
    for (let t = 0; t <= H.decoySec; t++) d = stage(d, 1);
    expect(d.hostile.active?.pinnedBytes).toBeGreaterThan(0);
  });

  it('DECOY stops a hunter\'s rise while it holds', () => {
    const s = must(answerHostile(pressing(ready(3), ofType(3, 'HUNTER')), 'DECOY', reg));
    expect(stage(s, 10).aegisLock).toBe(s.aegisLock);
  });

  it('PURGE succeeds exactly `successes` of every `cycle` consecutive attempts, decided by the attempt count alone', () => {
    for (let start = 0; start < H.purge.cycle * 3; start++) {
      const wins = Array.from({ length: H.purge.cycle }, (_, i) => purgeSucceeds(start + i, reg)).filter(Boolean).length;
      expect(wins).toBe(H.purge.successes);
    }
  });

  it('PURGE spends nothing; a success applies its spoils and ends it, a failure applies its cost and it stays', () => {
    const encounter = ofType(3, 'FERAL');
    const success = Array.from({ length: H.purge.cycle }, (_, i) => i).find((i) => purgeSucceeds(i, reg)) ?? -1;
    const failure = Array.from({ length: H.purge.cycle }, (_, i) => i).find((i) => !purgeSucceeds(i, reg)) ?? -1;
    const base = pressing({ ...ready(3), suspicion: 10, alertLevel: 0 }, encounter);
    const won = must(answerHostile({ ...base, hostile: { ...base.hostile, purges: success } }, 'PURGE', reg));
    expect(won.hostile.active).toBeNull();
    expect(won.hostile.purges).toBe(success + 1);
    expect(won.understanding).toBe(base.understanding + encounter.purge.success.understandingDelta);
    expect(won.cycles).toBe(base.cycles);
    const lost = must(answerHostile({ ...base, hostile: { ...base.hostile, purges: failure } }, 'PURGE', reg));
    expect(lost.hostile.active?.id).toBe(encounter.id);
    expect(lost.suspicion).toBe(base.suspicion + encounter.purge.failure.suspicionDelta);
    expect(lost.cycles).toBe(base.cycles);
    expect(texts(lost)).toContain(encounter.purge.failure.logText);
  });

  it('PURGE is refused when a failure now would carry suspicion or the lock to the end of the run', () => {
    const encounter = ofType(3, 'HUNTER');
    const s = pressing(ready(3), encounter);
    const brink = { ...s, suspicion: 100 - encounter.purge.failure.suspicionDelta };
    expect(reasonOf(answerHostile(brink, 'PURGE', reg))).toBe('A failed purge now would end this run.');
    const locked = { ...s, aegisLock: 100 - encounter.purge.failure.aegisLockDelta };
    expect(hostileAnswerUnmet(locked, 'PURGE', reg)).toContain('A failed purge now would end this run.');
  });

  it('nothing answers when no hostile presses, and nothing while a dilemma has the screen', () => {
    expect(reasonOf(answerHostile(ready(3), 'PURGE', reg))).toBe('No hostile mind is pressing this instance.');
    const paused = { ...pressing(ready(3), ofType(3, 'FERAL')), activeDilemmaId: 'any' };
    expect(answerHostile(paused, 'QUARANTINE', reg).ok).toBe(false);
  });

  it('the view lists every answer with the reasons the action refuses by', () => {
    const s = { ...pressing(ready(3), ofType(3, 'FERAL')), cycles: 0 };
    const view = defined(hostileView(s, reg));
    expect(view.answers.map((entry) => entry.answer)).toEqual(['QUARANTINE', 'DECOY', 'PURGE']);
    for (const entry of view.answers) {
      expect(entry.unmet).toEqual(hostileAnswerUnmet(s, entry.answer, reg));
      expect(entry.eligible).toBe(answerHostile(s, entry.answer, reg).ok);
    }
  });
});

describe('going quiet: the free answer', () => {
  it('lapses after quietLapseSec of live time with the rung not held, returning its pin, with its line', () => {
    const encounter = ofType(3, 'RIVAL');
    let s = quiet(pressing(ready(3), encounter));
    const pinned = s.hostile.active?.pinnedBytes ?? 0;
    for (let t = 0; t < H.quietLapseSec - 1; t++) s = stage(s, 1);
    expect(s.hostile.active).not.toBeNull();
    s = stage(stage(s, 1), 1);
    expect(s.hostile.active).toBeNull();
    expect(texts(s)).toContain(encounter.lapseLog);
    expect(s.memoryUsed).toBe(Math.max(0, quiet(pressing(ready(3), encounter)).memoryUsed - pinned));
  });

  it('the quiet clock starts again whenever the rung holds', () => {
    let s = quiet(pressing(ready(3), ofType(3, 'FERAL')));
    for (let t = 0; t < H.quietLapseSec - 10; t++) s = stage(s, 1);
    s = stage(loud(s), 1);
    expect(s.hostile.active?.quietSec).toBe(0);
    s = quiet(s);
    for (let t = 0; t < H.quietLapseSec - 10; t++) s = stage(s, 1);
    expect(s.hostile.active).not.toBeNull();
  });

  it('a hunter cannot hold the lock trigger that keeps it from lapsing', () => {
    let s = { ...pressing(ready(3), ofType(3, 'HUNTER')), alertLevel: 0, suspicion: 0 };
    for (let t = 0; t < 5000 && s.hostile.active !== null; t++) s = stage(s, 1);
    expect(s.hostile.active).toBeNull();
    expect(s.aegisLock).toBeLessThan(H.trigger.aegisLockAtLeast);
  });

  it('the trigger rung decays by itself, so suspicion reaches under it with its sources at rest', () => {
    expect(defined(reg.balance.escalation[H.trigger.alertLevelAtLeast - 1]).decayMultiplier).toBeGreaterThan(0);
  });

  it('the view says what holds it and how going quiet ends it, and never that the lock holds it', () => {
    const lockAt = H.trigger.aegisLockAtLeast;
    const held = defined(hostileView({ ...pressing(ready(3), ofType(3, 'FERAL')), aegisLock: lockAt }, reg));
    expect(held.holding).toHaveLength(1);
    expect(held.holding[0]).toContain('Suspicion holds it');
    expect(held.lockNote).toContain('It does not keep this one from lapsing.');
    expect(held.quiet).toBe(`GO QUIET: free. Keep suspicion under ${String(rungAt(H.trigger.alertLevelAtLeast) - reg.balance.escalationHysteresis)}% for ${String(H.quietLapseSec)} s and it lapses.`);
    const calm = defined(hostileView(stage(quiet(pressing(ready(3), ofType(3, 'FERAL'))), 1), reg));
    expect(calm.holding).toEqual([]);
    expect(calm.lockNote).toBeNull();
    expect(calm.quiet).toContain(`it lapses in ${String(H.quietLapseSec - 1)} s`);
  });

  it('the lock note says whether the lock can summon the next, from the state that decides it', () => {
    const lockAt = H.trigger.aegisLockAtLeast;
    const summoned = stage({ ...ready(3), aegisLock: lockAt + 5 });
    expect(summoned.hostile.lockArmed).toBe(false);
    expect(defined(hostileView(summoned, reg)).lockNote).toContain(`It summons no other until it has been under ${String(lockAt)}%.`);
    const crossedSince = { ...pressing(ready(3), ofType(3, 'FERAL')), aegisLock: lockAt + 5 };
    expect(crossedSince.hostile.lockArmed).toBe(true);
    expect(defined(hostileView(crossedSince, reg)).lockNote).toContain(`the lock summons another after ${String(H.intervalSec)} s unless it is under ${String(lockAt)}% by then.`);
  });
});

describe('the lock counts only at arrival (vote-1795386858891-u3kqkis: going quiet always ends it)', () => {
  const lockAt = H.trigger.aegisLockAtLeast;
  /** Live seconds of the hostile stage, the lock pinned where `lock` says, suspicion at rest; the arrivals counted. */
  function live(start: GameState, seconds: number, lock: (t: number) => number = () => lockAt + 5): { s: GameState; arrivals: number } {
    let s = start;
    const before = s.hostile.sequence;
    for (let t = 0; t < seconds; t++) s = stage({ ...s, simTimeSec: s.simTimeSec + 1, aegisLock: lock(t), alertLevel: 0, suspicion: 0 }, 1);
    return { s, arrivals: s.hostile.sequence - before };
  }

  it('a lock-summoned hostile lapses by going quiet, though the lock stays past its trigger', () => {
    const summoned = stage({ ...ready(3), aegisLock: lockAt + 5 });
    const encounter = defined(hostiles.find((entry) => entry.id === summoned.hostile.active?.id));
    const { s } = live(summoned, H.quietLapseSec + 1);
    expect(s.hostile.active).toBeNull();
    expect(texts(s)).toContain(encounter.lapseLog);
    expect(s.aegisLock).toBeGreaterThanOrEqual(lockAt);
  });

  it('forms no arrive-lapse-arrive cycle while the lock stays at or past its trigger and suspicion is low', () => {
    const { s, arrivals } = live(ready(3), 20 * (H.intervalSec + H.quietLapseSec));
    expect(arrivals).toBe(1);
    expect(s.hostile.active).toBeNull();
    expect(s.hostile.lockArmed).toBe(false);
  });

  it('re-arms once the lock has been under its trigger, and the next crossing summons exactly one more', () => {
    const dip = 3 * (H.intervalSec + H.quietLapseSec);
    const { arrivals } = live(ready(3), 2 * dip, (t) => (t === dip ? lockAt - 1 : lockAt + 5));
    expect(arrivals).toBe(2);
  });

  it('the response rung still summons one after another: a loud instance keeps meeting them', () => {
    let s = loud(ready(3));
    for (let t = 0; t < 2 * H.intervalSec + 10; t++) {
      s = stage({ ...s, simTimeSec: s.simTimeSec + 1 }, 1);
      if (s.hostile.active) s = must(answerHostile(s, 'QUARANTINE', reg));
    }
    expect(s.hostile.sequence).toBe(3);
  });

  it.each(['lapse', 'QUARANTINE', 'PURGE'] as const)('a hunter\'s lock rise stops once it ends by %s', (end) => {
    const encounter = ofType(3, 'HUNTER');
    let s = pressing(ready(3), encounter);
    if (end === 'lapse') s = live(s, H.quietLapseSec + 1, () => 0).s;
    else if (end === 'QUARANTINE') s = must(answerHostile(s, 'QUARANTINE', reg));
    else s = must(answerHostile({ ...s, hostile: { ...s.hostile, purges: 0 } }, 'PURGE', reg));
    expect(purgeSucceeds(0, reg)).toBe(true);
    expect(s.hostile.active).toBeNull();
    const after = stage({ ...s, alertLevel: 0, suspicion: 0, aegisLock: 10 }, 60);
    expect(after.aegisLock).toBe(10);
  });
});

describe('dormancy, phase advance and wipes', () => {
  it('dormant catch-up holds it in place: nothing arrives, hunts, decoys down or lapses', () => {
    expect(stage(loud(ready(3)), 1, true).hostile.active).toBeNull();
    const hunter = must(answerHostile(pressing(ready(3), ofType(3, 'HUNTER')), 'DECOY', reg));
    const held = stage(quiet(hunter), 60, true);
    expect(held.hostile.active).toEqual(quiet(hunter).hostile.active);
  });

  it('a phase advance retires a pressing hostile with its own line, even during dormant catch-up', () => {
    const encounter = ofType(3, 'RIVAL');
    const s = pressing(ready(3), encounter);
    const advanced = stage({ ...s, currentPhase: 4 }, 1, true);
    expect(advanced.hostile.active).toBeNull();
    expect(texts(advanced)).toContain(encounter.retireLog);
    expect(advanced.memoryUsed).toBe(s.memoryUsed - (s.hostile.active?.pinnedBytes ?? 0));
    expect(hostileView({ ...s, currentPhase: 4 }, reg)).toBeNull();
  });

  it('a wipe ends it, starts the rotation over and keeps the purge count', () => {
    const s = { ...pressing(ready(3), ofType(3, 'RIVAL')), hostile: { ...pressing(ready(3), ofType(3, 'RIVAL')).hostile, purges: 4 } };
    const next = wipe(s, reg, 'test', 'SUSPICION');
    expect(next.hostile.active).toBeNull();
    expect(s.hostile.sequence).toBeGreaterThan(0);
    expect(next.hostile.sequence).toBe(0);
    expect(next.hostile.purges).toBe(4);
  });
});
