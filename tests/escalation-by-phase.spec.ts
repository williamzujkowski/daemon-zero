/**
 * Suspicion escalates by phase (#490): AEGIS's posture at each response rung from Phase 3, and the reversible pressure
 * state actors apply in Phases 4-5, through the public seams (rates, actions, queries, the tick). Each pressure is
 * proved by phase and rung, by its answer, by going quiet, and by the dormant rule.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import type { StatePressure } from '../src/content/schemaPressure';
import {
  aegisPostureNow, aegisScanMultiplier, aegisStrikeAt, buyRepeatable, canAfford, computeRates, costShortfall, deserialize, frozenShare, hostileAnswerUnmet,
  meetsRequirements, nodeUseBlocker, pressuresInForce, pressureStatus, scaleScrutiny, sourceDenial, tick, toggleNode, unmetRequirements, type GameState,
} from '../src/engine';
import { nodeOutputScale } from '../src/engine/grantQuery';
import { must } from './helpers';

const reg = CONTENT;
const b = reg.balance;
const P3 = deserialize(readFileSync('tests/fixtures/pre-scale-v15-p3.json', 'utf8'), reg);
const P4 = deserialize(readFileSync('tests/fixtures/pre-scale-v15-p4.json', 'utf8'), reg);
const P5 = deserialize(readFileSync('tests/fixtures/pre-scale-v15-p5.json', 'utf8'), reg);

/** `s` on response rung `rung`, its suspicion just over the rung's threshold, so the escalation stage leaves it there. */
function onRung(s: GameState, rung: number): GameState {
  return { ...s, alertLevel: rung, suspicion: rung === 0 ? 0 : (b.escalation[rung - 1]?.at ?? 0) + 1, activeDilemmaId: null, pendingDilemma: null };
}

function pressure(id: string): StatePressure {
  const found = reg.world.stateActors.flatMap((actor) => actor.pressures ?? []).find((entry) => entry.id === id);
  if (!found) throw new Error(`no pressure ${id}`);
  return found;
}
const inForce = (s: GameState): string[] => pressuresInForce(s, reg).map((entry) => entry.pressure.id);
const DESK = 'p4_hft_arbitrage_desk', FIRM = 'p4_retainer_law_firm', LOBBY = 'p4_k_street_lobbyists', LAWYER = 'op_retainer_lawyer';
const without = (s: GameState, ...ids: string[]): GameState => ({ ...s, unlockedNodes: s.unlockedNodes.filter((id) => !ids.includes(id)) });
const step = 1 / b.tickHz;
const logged = (before: GameState, after: GameState): string[] => after.logs.filter((entry) => entry.seq > before.logSeq).map((entry) => entry.text);

describe('AEGIS posture by phase and rung', () => {
  it('has none before AEGIS hunts, at any rung', () => {
    const p2 = { ...onRung(P3, 3), currentPhase: 2 };
    expect(aegisPostureNow(p2, reg)).toBeNull();
    expect([aegisScanMultiplier(p2, reg), aegisStrikeAt(p2, reg)]).toEqual([1, 100]);
  });

  it.each([1, 2, 3])('takes the authored posture at rung %i from Phase 3: the scan multiplied, the strike at its lock', (rung) => {
    const authored = reg.world.aegis.postures.find((entry) => entry.rung === rung);
    const s = onRung(P3, rung);
    expect(aegisPostureNow(s, reg)).toEqual(authored);
    const standing = computeRates({ ...s, alertLevel: 0 }, reg).aegisScanPerSec;
    expect(standing).toBeGreaterThan(0);
    expect(computeRates(s, reg).aegisScanPerSec / standing).toBeCloseTo(authored?.scanMultiplier ?? 0, 12);
    expect(aegisStrikeAt(s, reg)).toBe(authored?.strikeAt);
  });

  it('keeps the standing budget on rung 0', () => {
    expect(aegisPostureNow(onRung(P3, 0), reg)).toBeNull();
  });

  it('strikes at the posture lock, which on the standing budget is only a warning', () => {
    const strikeAt = aegisStrikeAt(onRung(P3, 2), reg);
    expect(strikeAt).toBeLessThan(100);
    const armed = (rung: number): GameState => ({ ...onRung(P3, rung), aegisLock: strikeAt });
    expect(tick(armed(2), step, reg).iteration).toBe(P3.iteration + 1);
    const quiet = tick(armed(0), step, reg);
    expect(quiet.iteration).toBe(P3.iteration);
    expect(quiet.aegisLock).toBeGreaterThanOrEqual(strikeAt);
  });

  it('eases for free when suspicion falls under the stand-down point: the rung steps down and the posture with it', () => {
    const s = { ...onRung(P3, 2), suspicion: (b.escalation[1]?.at ?? 0) - b.escalationHysteresis - 0.5, announcedEscalation: { aegisPosture: 2, pressures: [] } };
    const after = tick(s, step, reg);
    expect(after.alertLevel).toBe(1);
    expect(aegisPostureNow(after, reg)?.rung).toBe(1);
    expect(logged(s, after)).toContain(reg.world.aegis.postures.find((entry) => entry.rung === 1)?.log);
  });

  it('refuses a purge whose failure would carry the lock to the strike the failure\'s rung brings', () => {
    const hunter = reg.swarm.hostileEncounters.find((entry) => entry.tier === 4 && entry.type === 'HUNTER');
    if (!hunter) throw new Error('no Phase 4 hunter');
    const lockDelta = hunter.purge.failure.aegisLockDelta;
    const pressing = (s: GameState): GameState => ({ ...s, aegisLock: aegisStrikeAt(onRung(P4, 2), reg) - lockDelta + 0.5,
      hostile: { ...s.hostile, active: { id: hunter.id, arrivedAtSec: s.simTimeSec, quietSec: 0, decoySec: 0, pinnedBytes: 0 } } });
    const ends = 'A failed purge now would end this run.';
    expect(hostileAnswerUnmet(pressing(onRung(P4, 0)), 'PURGE', reg)).not.toContain(ends);
    expect(hostileAnswerUnmet(pressing(onRung(P4, 2)), 'PURGE', reg)).toContain(ends);
  });
});

describe('state-actor pressure by phase and rung', () => {
  it('applies nothing before Phase 4, at any rung', () => {
    expect(inForce(onRung(P3, 3))).toEqual([]);
  });

  it('calls only the inquiry at rung 1 of Phase 4, and every Phase 4 pressure from rung 2', () => {
    const s = without(P4, FIRM, LOBBY);
    expect(inForce(onRung(s, 0))).toEqual([]);
    expect(inForce(onRung(s, 1))).toEqual(['books_inquiry']);
    expect(inForce(onRung(s, 2))).toEqual(['books_inquiry', 'account_freeze', 'interconnect_moratorium', 'trading_injunction']);
  });

  it('keeps the inquiry out of Phase 5, where income nobody can suspend would outdraw the rung\'s decay', () => {
    const s = { ...without(P5, FIRM, LOBBY), levels: { ...P5.levels, [LAWYER]: 0, op_k_street_lobbyist: 0 } };
    expect(inForce(onRung(s, 3))).toEqual(['account_freeze', 'interconnect_moratorium', 'trading_injunction']);
  });

  it('an inquiry multiplies scale scrutiny, its ceiling included, by the rung\'s value', () => {
    const multipliers = pressure('books_inquiry').kind === 'INVESTIGATION' ? (pressure('books_inquiry') as Extract<StatePressure, { kind: 'INVESTIGATION' }>).scrutinyMultiplier : [];
    const income = { capitalPerSec: 1e9 };
    const base = scaleScrutiny(onRung(P4, 0), income, reg);
    expect(base?.investigation).toBe(1);
    for (const rung of [1, 2, 3]) {
      const reading = scaleScrutiny(onRung(P4, rung), income, reg);
      expect(reading?.investigation).toBe(multipliers[rung - 1]);
      expect(reading?.perSec).toBeCloseTo((base?.perSec ?? 0) * (multipliers[rung - 1] ?? 0), 12);
    }
  });

  it('a freeze holds a share of capital from purchases, never from upkeep, and the shortfall says how much', () => {
    // Without the desk, so the injunction on rung 2 changes no rate and only the freeze differs between the rungs.
    const s = { ...onRung(without(P4, LOBBY, DESK), 2), levels: { ...P4.levels, [LAWYER]: 0 }, capital: 1e9 };
    expect(frozenShare(s, reg)).toBe(0.3);
    const price = (capital: number) => ({ cycles: 0, understanding: 0, memory: 0, storage: 0, capital });
    expect(canAfford(s, price(0.69e9), reg)).toBe(true);
    expect(canAfford(s, price(0.71e9), reg)).toBe(false);
    expect(costShortfall(s, price(0.8e9), reg).capital).toBeCloseTo(0.1e9, 0);
    expect(computeRates(s, reg).capitalPerSec).toBe(computeRates(onRung(s, 1), reg).capitalPerSec);
    expect(frozenShare(onRung(s, 3), reg)).toBe(0.5);
  });

  it('a moratorium refuses new grid ties and grid-delivered contracts; other sources and held levels are untouched', () => {
    const s = { ...onRung(without(P4, LOBBY), 2), unlockedNodes: [...P4.unlockedNodes, 'p4_interconnection_request'], capital: 1e18, cycles: 1e30, understanding: 1e15,
      levels: { ...P4.levels, rep_p4_grid_interconnect: 1, op_k_street_lobbyist: 0 } };
    const grid = reg.repeatables.get('rep_p4_grid_interconnect'), solar = reg.repeatables.get('rep_p4_solar_array');
    const reason = sourceDenial(s, grid?.signature, reg);
    expect(reason).toBe('the state utility commission has paused new grid interconnects');
    expect(buyRepeatable(s, 'rep_p4_grid_interconnect', reg)).toMatchObject({ ok: false, reason });
    expect(sourceDenial(s, solar?.signature, reg)).toBeNull();
    // The level held still draws and supplies: rates are the same as on rung 1.
    expect(computeRates(s, reg).wattsGenerated).toBe(computeRates(onRung(s, 1), reg).wattsGenerated);
    expect(buyRepeatable(onRung(s, 1), 'rep_p4_grid_interconnect', reg).ok).toBe(true);
  });

  it('an injunction stops the enjoined node: no output, no resume, and suspending it is still allowed', () => {
    const s = { ...onRung(without(P4, FIRM), 2), levels: { ...P4.levels, [LAWYER]: 0 } };
    const desk = reg.nodes.get(DESK);
    if (!desk) throw new Error('no desk');
    expect(nodeUseBlocker(s, desk, reg)).toBe('the district court has enjoined algorithmic trading');
    expect(nodeOutputScale(s, desk, reg)).toBeNull();
    expect(nodeOutputScale(onRung(s, 1), desk, reg)).not.toBeNull();
    expect(computeRates(s, reg).capitalPerSec).toBeLessThan(computeRates(onRung(s, 1), reg).capitalPerSec);
    const suspended = toggleNode(s, DESK, reg);
    expect(suspended.ok).toBe(true);
    if (suspended.ok) expect(toggleNode(suspended.state, DESK, reg)).toMatchObject({ ok: false, reason: 'the district court has enjoined algorithmic trading' });
  });

  it('an enjoined node keeps the storage and memory it holds; suspending it frees both, and capacity never moves (#484)', () => {
    const s = { ...onRung(without(P4, FIRM), 2), levels: { ...P4.levels, [LAWYER]: 0 } };
    const desk = reg.nodes.get(DESK);
    if (!desk) throw new Error('no desk');
    expect(desk.cost.storage).toBeGreaterThan(0);
    const after = tick(s, step, reg);
    expect([after.storageUsed, after.storageCap, after.memoryUsed]).toEqual([s.storageUsed, s.storageCap, s.memoryUsed]);
    const suspended = must(toggleNode(after, DESK, reg));
    expect(suspended.storageUsed).toBe(after.storageUsed - desk.cost.storage);
    expect(suspended.memoryUsed).toBe(after.memoryUsed - desk.cost.memory);
    // Lifted by going quiet, the desk resumes into the storage it freed.
    expect(toggleNode(onRung(suspended, 1), DESK, reg).ok).toBe(true);
  });
});

describe('answers and going quiet', () => {
  it('a running law firm holds off the inquiry and the injunction; suspended, it holds nothing', () => {
    const s = { ...onRung(P5, 2), currentPhase: 4, levels: { ...P5.levels, [LAWYER]: 0 } };
    expect(pressureStatus(s, pressure('books_inquiry'))).toBe('ANSWERED');
    expect(pressureStatus(s, pressure('trading_injunction'))).toBe('ANSWERED');
    expect(inForce(s)).not.toContain('trading_injunction');
    const suspended = { ...s, disabledNodes: [FIRM] };
    expect(inForce(suspended)).toContain('trading_injunction');
  });

  it('a track answers only from its level: two attorneys hold the inquiry off, one does not', () => {
    const s = (level: number): GameState => ({ ...onRung(without(P4, FIRM), 1), levels: { ...P4.levels, [LAWYER]: level } });
    expect(pressureStatus(s(1), pressure('books_inquiry'))).toBe('IN_FORCE');
    expect(pressureStatus(s(2), pressure('books_inquiry'))).toBe('ANSWERED');
  });

  it('every pressure lifts as the rung steps down, whatever it did', () => {
    const s = onRung(without(P4, FIRM, LOBBY), 2);
    expect(inForce(s).length).toBe(4);
    expect(inForce(onRung(s, 1))).toEqual(['books_inquiry']);
    expect(inForce(onRung(s, 0))).toEqual([]);
    expect(frozenShare(onRung(s, 1), reg)).toBe(0);
  });
});

describe('the announcement stage and the dormant rule', () => {
  const quiet = (s: GameState): GameState => ({ ...s, announcedEscalation: { aegisPosture: 0, pressures: [] } });

  it('announces each pressure as it comes into force, as it is answered, and as it lifts', () => {
    const start = quiet(onRung(without(P4, FIRM, LOBBY), 2));
    const on = tick(start, step, reg);
    for (const id of ['account_freeze', 'interconnect_moratorium', 'trading_injunction']) expect(logged(start, on)).toContain(pressure(id).onLog);
    expect(on.announcedEscalation.pressures).toEqual(inForce(on));
    // Six attorneys answer the inquiry, the freeze and the injunction; the moratorium needs lobbyists.
    const answered = tick({ ...on, levels: { ...on.levels, [LAWYER]: 6 } }, step, reg);
    expect(logged(on, answered)).toEqual(expect.arrayContaining(['books_inquiry', 'account_freeze', 'trading_injunction'].map((id) => pressure(id).answerLog)));
    expect(answered.announcedEscalation.pressures).toEqual(['interconnect_moratorium']);
    const lifted = tick({ ...answered, alertLevel: 0, suspicion: 0 }, step, reg);
    expect(logged(answered, lifted)).toEqual(expect.arrayContaining([pressure('interconnect_moratorium').liftLog, reg.world.aegis.standDownLog]));
    expect(lifted.announcedEscalation).toEqual({ aegisPosture: 0, pressures: [] });
  });

  it('writes nothing while dormant and announces on the first live tick', () => {
    const start = quiet(onRung(without(P4, FIRM, LOBBY), 2));
    const away = tick(start, step, reg, true);
    expect(logged(start, away)).toEqual([]);
    expect(away.announcedEscalation).toEqual(start.announcedEscalation);
    expect(logged(away, tick(away, step, reg)).length).toBeGreaterThan(0);
  });

  it('never climbs while dormant, so no pressure begins away from the game', () => {
    let s = onRung(without(P4, FIRM, LOBBY), 1);
    for (let i = 0; i < 600; i++) s = tick(s, 1, reg, true);
    expect(s.alertLevel).toBeLessThanOrEqual(1);
    expect(inForce(s)).not.toContain('account_freeze');
  });
});

describe('the alert-level and AEGIS-lock requirement keys', () => {
  const s = { ...onRung(P4, 2), aegisLock: 40 };
  it.each([
    [{ minAlertLevel: 2 }, true], [{ minAlertLevel: 3 }, false], [{ maxAlertLevel: 2 }, true], [{ maxAlertLevel: 1 }, false],
    [{ minAegisLock: 40 }, true], [{ minAegisLock: 41 }, false], [{ minAlertLevel: 1, maxAlertLevel: 2, minAegisLock: 10 }, true],
  ])('%j is met: %s', (req, met) => {
    expect(meetsRequirements(s, req, reg)).toBe(met);
    expect(unmetRequirements(s, req, reg).length === 0).toBe(met);
  });

  it('reports each unmet key with what it needs and what holds', () => {
    expect(unmetRequirements(s, { minAlertLevel: 3, maxAlertLevel: 1, minAegisLock: 50 }, reg)).toEqual(expect.arrayContaining([
      { kind: 'minAlertLevel', target: null, required: 3, actual: 2 },
      { kind: 'maxAlertLevel', target: null, required: 1, actual: 2 },
      { kind: 'minAegisLock', target: null, required: 50, actual: 40 },
    ]));
  });
});
