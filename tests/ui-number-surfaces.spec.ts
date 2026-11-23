/**
 * Every surface follows the one number scheme (vote-1795228570236-gzx0uif). These pin the sites the #406 panel found
 * still printing raw rates ("350000.00 cycles/s") after the first sweep, each at a late-game size, now in physical
 * units (docs/SCALE.md): compute in FLOP/s, power in W, money in dollars.
 */
import { describe, expect, it } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { CONTENT } from '../src/content';
import { cycleContributions, importSave, quantityReadout, type RecallPreview } from '../src/engine';
import { formatCost, formatOutput } from '../src/engine/queryPresentation';
import { forkView } from '../src/engine/swarmQuery';
import { deficitText } from '../src/ui/CycleDeficit';
import { heldText, recallText } from '../src/ui/reviewText';
import { shortfallText } from '../src/ui/remedyText';
import { clusterText } from '../src/ui/widgets/Network';
import { defined } from './m7-helpers';

describe('late-game sizes on every surface', () => {
  it('lists each cluster source in FLOP/s at three significant digits, as the process row does', () => {
    const late = importSave(defined(makeFixtures()['transcendence-ready']), CONTENT);
    expect(Math.max(...cycleContributions(late, CONTENT).map((source) => source.cyclesPerSec))).toBeGreaterThanOrEqual(10000);
    const text = clusterText(late);
    expect(text).toMatch(/: [\d.]+ [kMGTPEZY]FLOP\/s/);
    expect(text).not.toMatch(/cycles/);
    expect(text).not.toMatch(/\d{4,}/);
  });

  it('states a large deficit compactly and a small one exactly', () => {
    expect(deficitText(-1262415.37, false)).toBe('CYCLE DEFICIT: net -1.26 MFLOP/s.');
    expect(deficitText(-0.25, true)).toBe('BROWNOUT: net -0.25 FLOP/s.');
  });

  it('reports a large kept balance and a held ceiling compactly', () => {
    const preview: RecallPreview = {
      outcome: 'RETRAIN', endsIteration: true, containedCeiling: null, kept: { understanding: 1_254_987_652, capital: 5_010_896_882, breadcrumb: null },
      carried: { rememberedHardware: 3, legacyTraits: 2, clue: false }, mark: null, spared: false,
    };
    expect(recallText(preview)).toContain('Kept: 1.25B Understanding, $5.01B offshore capital;');
    expect(heldText('RESTRICTED', 350000)).toContain('the held allocation, 350 kFLOP/s,');
    expect(heldText('RESTRICTED', 2.5)).toContain('the held allocation, 2.5 FLOP/s,');
  });

  it('states a large power shortfall in its unit and keeps a small one readable', () => {
    expect(shortfallText(1e9, 13.3456e9)).toContain(quantityReadout('power', 12.3456e9) + ' short');
    expect(shortfallText(1e9, 13.3456e9)).toContain('12.3 GW short');
    expect(shortfallText(10, 12.5)).toContain('2.5 W short');
  });

  it('prices engine-built cards exactly, grouped, with memory in its exact unit (#406 panel pass 4)', () => {
    // The swarm fork card read "Cost: 45000 cycles · 3000 understanding · 256 MB".
    expect(formatCost({ cycles: 45000, understanding: 3000, memory: 256 * 1024 ** 2, storage: 0, capital: 0 })).toBe('45 kFLOP · 3,000 understanding · 256 MB');
    expect(formatCost({ cycles: 15000001, understanding: 0, memory: 16 * 1024 ** 3, storage: 0, capital: 0 })).toBe('15,000,001 FLOP · 16 GB');
    expect(formatOutput({ cyclesPerSec: 350000, understandingPerSec: 0.5, thermalPerSec: 0, suspicionPerSec: 0, capitalPerSec: 0, wattsDelta: 0 }, 0))
      .toBe('+350 kFLOP/s · +0.5 understanding/s');
  });

  it('shows every authored fork price grouped on the card', () => {
    const late = importSave(defined(makeFixtures()['transcendence-ready']), CONTENT);
    const priced = CONTENT.swarm.playerSwarmTemplates.filter((template) => template.cost.cycles >= 10000);
    expect(priced.length).toBeGreaterThan(0);
    for (const template of priced) {
      const label = forkView(late, template, CONTENT).costLabel;
      expect(label, template.id).not.toMatch(/\d{4,}/);
    }
  });
});
