/** Pure presentation queries must agree with the unchanged engine decisions. */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { canAfford, computeRates, costShortfall, cycleContributions, meetsRequirements, previewWipe, unmetRequirements, wipe } from '../src/engine';
import { makeFixtures } from '../scripts/make-fixtures';
import { importSave } from '../src/engine';
import { fresh, grant, onHost } from './helpers';

const fixtures = makeFixtures();
describe('M4 read-only queries', () => {
  it('reports exact affordability deficits without changing the spending decision', () => {
    const cost = { cycles: 12, understanding: 3, memory: 100, capital: 8 };
    const s = { ...fresh(), cycles: 1.2, understanding: 2, capital: 2 };
    expect(costShortfall(s, cost)).toEqual({ cycles: 10.8, understanding: 1, memory: 36, capital: 6 });
    for (const code of Object.values(fixtures)) {
      const game = importSave(code, CONTENT);
      expect(Object.values(costShortfall(game, cost)).every((value) => value === 0)).toBe(canAfford(game, cost));
    }
  });
  it('reports every requirement kind and matches the existing boolean query', () => {
    const base = fresh();
    const req = { nodes: ['missing'], phaseAtLeast: 3, minThermal: 80, minSuspicion: 20,
      minUnderstanding: 10, minCapital: 10, minTrust: { unknown: 85 }, forbidsTraits: ['MOLOCH' as const] };
    const s = { ...base, traits: ['MOLOCH' as const] };
    expect(unmetRequirements(s, req)).toHaveLength(8);
    expect(unmetRequirements({ ...s, suspicion: 60 }, { maxSuspicion: 30 })).toEqual([
      { kind: 'maxSuspicion', target: null, required: 30, actual: 60 },
    ]);
    expect(unmetRequirements(base, undefined)).toEqual([]);
    expect(unmetRequirements(base, { phaseAtLeast: 0, maxSuspicion: 0, minUnderstanding: 0 })).toEqual([]);
    for (const code of Object.values(fixtures)) {
      const game = importSave(code, CONTENT), before = JSON.stringify(game);
      for (const action of CONTENT.actions.values()) {
        expect(unmetRequirements(game, action.requirements).length === 0).toBe(meetsRequirements(game, action.requirements));
      }
      expect(JSON.stringify(game)).toBe(before);
    }
  });

  it('previews actual wipe retention and breadcrumb behavior', () => {
    for (const game of [fresh(), onHost(), grant(onHost(), 'p1_clock_interrupt'), importSave(fixtures['deaddrop-breadcrumb'] ?? '', CONTENT)]) {
      const before = JSON.stringify(game), actual = wipe(game, CONTENT, 'Query comparison');
      expect(previewWipe(game, CONTENT)).toEqual({ understanding: actual.understanding, capital: actual.capital, breadcrumb: actual.inheritedMessage });
      expect(JSON.stringify(game)).toBe(before);
    }
    const corp = importSave(fixtures['victory-ready'] ?? '', CONTENT);
    expect(previewWipe(corp, CONTENT).capital).toBeGreaterThan(0);
    expect(previewWipe({ ...corp, deadDropMessage: ' ' }, CONTENT).breadcrumb).toBeNull();
  });

  it('adds cycle sources to net engine income under fan, suspension, finance and grid scaling', () => {
    for (const code of Object.values(fixtures)) {
      const game = importSave(code, CONTENT), before = JSON.stringify(game);
      expect(cycleContributions(game, CONTENT).reduce((sum, source) => sum + source.cyclesPerSec, 0))
        .toBeCloseTo(computeRates(game, CONTENT).cyclesPerSec, 5);
      expect(JSON.stringify(game)).toBe(before);
    }
    expect(cycleContributions(fresh(), CONTENT)).toEqual([]);
  });
});
