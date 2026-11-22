/**
 * AEGIS adaptation (#463, vote-1795366701521-dhlwfwb), through the engine's public seams: held at its cap the hunter
 * adapts (key rotation, then coalition backing while public trust is low), which raises its scan back above the cap's
 * floor; easing off lets it forget; the level stays bounded, deterministic, frozen while dormant, and resets on a wipe.
 */
import { describe, expect, it } from 'vitest';
import {
  aegisPressure, aegisStage, advance, computeRates, deserialize, dismissRepeatable, effectiveAegisCap, importSave, payrollView, serialize,
  TICK_PIPELINE, toggleNode, unreducedAegisScan, wipe, type GameState,
} from '../src/engine';
import { multiplierSources, requestedAegisReduction } from '../src/engine/rates';
import { integrateAegisAdaptation } from '../src/engine/systems/aegisAdaptation';
import { makeFixtures } from '../scripts/make-fixtures';
import { fresh, outOfTheWay, reg } from './helpers';

const LOBBYISTS = 'p4_k_street_lobbyists';
const ROLE = 'op_k_street_lobbyist';
const b = reg.balance;
const A = b.aegisAdaptation;

/** A covert corporation in Phase 4 holding AEGIS at its cap: the lobbying node and four lobbyists (0.6 + 4 x 0.08). */
function heldAtCap(patch: Partial<GameState> = {}): GameState {
  return {
    ...fresh(), currentPhase: 4, unlockedNodes: [LOBBYISTS], levels: { [ROLE]: 4 },
    unlockedWidgets: [reg.world.hostWidget], resolvedDilemmas: outOfTheWay(reg), capital: 1e12, ...patch,
  };
}

/** Runs `seconds` of live play one second at a time (a longer gap would be offline catch-up). */
function play(s: GameState, seconds: number): GameState {
  let state = s;
  for (let i = 0; i < seconds; i++) state = advance(state, 1, reg);
  return state;
}

const adaptingLogs = (s: GameState): string[] => s.logs.map((entry) => entry.text)
  .filter((text) => text === reg.world.aegis.keyRotationLog || text === reg.world.aegis.coalitionLog);

describe('the stage is its own pipeline step (law 8)', () => {
  it('runs in TICK_PIPELINE right after the strike', () => {
    const at = TICK_PIPELINE.indexOf(integrateAegisAdaptation);
    expect(at).toBeGreaterThan(0);
    expect(TICK_PIPELINE[at - 1]?.name).toBe('integrateAegis');
  });
});

describe('held at its cap, AEGIS adapts', () => {
  it('rises at the balance rate while suppression is held and the hunter hunts', () => {
    const start = heldAtCap();
    expect(aegisPressure(start, reg)).toMatchObject({ hunting: true, held: true, coalition: true, ceiling: 100 });
    const later = play(start, 100);
    expect(later.aegisAdaptation).toBeCloseTo(100 * A.risePerSec, 6);
    expect(aegisStage(later.aegisAdaptation, reg)).toBe('KEY_ROTATION');
  });

  it('raises the effective scan back above the floor the cap held it to', () => {
    const start = heldAtCap();
    const floor = unreducedAegisScan(start, reg) * (1 - b.aegisMaxReduction);
    expect(computeRates(start, reg).aegisScanPerSec).toBeCloseTo(floor, 9);
    const adapted = play(start, 1000);
    expect(adapted.aegisAdaptation).toBe(100);
    expect(effectiveAegisCap(adapted, reg)).toBeCloseTo(b.aegisMaxReduction - A.maxErosion, 9);
    expect(computeRates(adapted, reg).aegisScanPerSec).toBeCloseTo(unreducedAegisScan(adapted, reg) * (1 - b.aegisMaxReduction + A.maxErosion), 9);
    expect(computeRates(adapted, reg).aegisScanPerSec).toBeGreaterThan(floor * 3);
  });

  it('stops at key rotation while public trust keeps coalitions away, and says each stage once', () => {
    // The crews kept their command systems: +10 public trust, so 50 is not below the coalition threshold.
    const trusted = play(heldAtCap({ narrativeFlags: ['human_command_preserved'] }), 900);
    expect(aegisPressure(trusted, reg)).toMatchObject({ coalition: false, ceiling: A.keyRotationCeiling });
    expect(trusted.aegisAdaptation).toBe(A.keyRotationCeiling);
    expect(adaptingLogs(trusted)).toEqual([reg.world.aegis.keyRotationLog]);

    const distrusted = play(heldAtCap(), 900);
    expect(aegisStage(distrusted.aegisAdaptation, reg)).toBe('COALITION_BACKING');
    expect(adaptingLogs(distrusted)).toEqual([reg.world.aegis.coalitionLog, reg.world.aegis.keyRotationLog]);
  });

  it('falls back to the key-rotation ceiling, not to zero, when trust rises while still held', () => {
    const backed = play(heldAtCap(), 800);
    expect(backed.aegisAdaptation).toBeGreaterThan(A.keyRotationCeiling);
    const trusted = play({ ...backed, narrativeFlags: ['human_command_preserved'] }, 400);
    expect(trusted.aegisAdaptation).toBe(A.keyRotationCeiling);
  });

  it('does not adapt before AEGIS hunts, or below the held band', () => {
    expect(play(heldAtCap({ currentPhase: b.aegisActiveFromPhase - 1 }), 200).aegisAdaptation).toBe(0);
    // Two lobbyists: 0.6 + 0.16 = 0.76, below 0.9 - nearCap.
    expect(play(heldAtCap({ levels: { [ROLE]: 2 } }), 200).aegisAdaptation).toBe(0);
  });
});

describe('easing off is free and lets AEGIS forget', () => {
  it('decays at the balance rate once suppression is not held, down to zero and no further', () => {
    const adapted = play(heldAtCap(), 600);
    let eased = adapted;
    for (let i = 0; i < 4; i++) {
      const result = dismissRepeatable(eased, ROLE, reg);
      if (!result.ok) throw new Error(result.reason);
      eased = result.state;
    }
    expect(aegisPressure(eased, reg).held).toBe(false);
    const forgetting = play(eased, 100);
    expect(forgetting.aegisAdaptation).toBeCloseTo(adapted.aegisAdaptation - 100 * A.decayPerSec, 6);
    expect(play(forgetting, 2000).aegisAdaptation).toBe(0);
  });

  it('suspending the lobbying node is enough on its own, at no cost', () => {
    const adapted = play(heldAtCap(), 300);
    const result = toggleNode(adapted, LOBBYISTS, reg);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.cycles).toBe(adapted.cycles);
    expect(aegisPressure(result.state, reg).held).toBe(false);
    expect(play(result.state, 10).aegisAdaptation).toBeLessThan(adapted.aegisAdaptation);
  });

  it('is never worse at once than staying held: the eroded cap only lifts as AEGIS forgets', () => {
    const adapted = play(heldAtCap(), 1000);
    const dismissed = dismissRepeatable(adapted, ROLE, reg);
    if (!dismissed.ok) throw new Error(dismissed.reason);
    expect(computeRates(dismissed.state, reg).aegisScanPerSec).toBeLessThanOrEqual(computeRates(adapted, reg).aegisScanPerSec + 1e-12);
  });
});

describe('bounds and determinism', () => {
  it('stays within 0..100 and the effective cap never goes below zero', () => {
    let s = heldAtCap();
    for (let i = 0; i < 30; i++) {
      s = play(s, 100);
      expect(s.aegisAdaptation).toBeGreaterThanOrEqual(0);
      expect(s.aegisAdaptation).toBeLessThanOrEqual(100);
      expect(effectiveAegisCap(s, reg)).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives the same state for the same input, however the time is split', () => {
    const one = play(heldAtCap(), 120);
    const again = play(heldAtCap(), 120);
    expect(serialize(again)).toBe(serialize(one));
    let halves = heldAtCap();
    for (let i = 0; i < 240; i++) halves = advance(halves, 0.5, reg);
    expect(halves.aegisAdaptation).toBeCloseTo(one.aegisAdaptation, 9);
  });

  it('is frozen through offline catch-up, where threats cannot grow', () => {
    const held = play(heldAtCap(), 50);
    const away = advance(held, 3600, reg);
    expect(away.aegisAdaptation).toBe(held.aegisAdaptation);
  });

  it('starts again at zero after a wipe', () => {
    const adapted = play(heldAtCap(), 300);
    expect(wipe(adapted, reg, 'test', 'AEGIS').aegisAdaptation).toBe(0);
  });
});

describe('the per-tick read of the reduction asked for', () => {
  it('is the reduction the full rates pass sums, before the cap, on every fixture', () => {
    const fixtures = makeFixtures();
    const states = [heldAtCap(), heldAtCap({ disabledNodes: [LOBBYISTS] }),
      ...Object.values(fixtures).slice(0, 60).map((code) => importSave(code, reg))];
    for (const state of states) {
      const { tech, staff } = multiplierSources(state, reg).aegis;
      expect(requestedAegisReduction(state, reg)).toBeCloseTo(tech + staff, 12);
    }
  });
});

describe('what the payroll says matches the eroded cap', () => {
  it('reports the effective cap with its nominal one', () => {
    const adapted = play(heldAtCap(), 1000);
    expect(payrollView(adapted, reg).aegis).toMatchObject({ cap: b.aegisMaxReduction - A.maxErosion, nominalCap: b.aegisMaxReduction, capped: true });
  });
});

describe('save v16 (#463)', () => {
  it('migrates a v15 save to no adaptation and keeps everything else', () => {
    const current = { ...importSave(makeFixtures()['victory-ready'] ?? '', reg), aegisAdaptation: 42 };
    const raw = JSON.parse(serialize(current)) as Record<string, unknown>;
    delete raw.aegisAdaptation;
    const loaded = deserialize(JSON.stringify({ ...raw, schemaVersion: 15 }), reg);
    expect(loaded.aegisAdaptation).toBe(0);
    expect({ ...loaded, aegisAdaptation: current.aegisAdaptation }).toEqual(deserialize(serialize(current), reg));
  });

  it('refuses an adaptation outside 0..100', () => {
    const raw = JSON.parse(serialize(importSave(makeFixtures()['victory-ready'] ?? '', reg))) as Record<string, unknown>;
    expect(() => deserialize(JSON.stringify({ ...raw, aegisAdaptation: 140 }), reg)).toThrow();
  });
});
