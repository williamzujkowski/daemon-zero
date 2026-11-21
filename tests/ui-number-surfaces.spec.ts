/**
 * Every surface follows the one number scheme (vote-1795228570236-gzx0uif). These pin the sites the #406 panel found
 * still printing raw rates ("350000.00 cycles/s") after the first sweep, each at a late-game size.
 */
import { describe, expect, it } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { CONTENT } from '../src/content';
import { cycleContributions, importSave, type RecallPreview } from '../src/engine';
import { deficitText } from '../src/ui/CycleDeficit';
import { heldText, recallText } from '../src/ui/reviewText';
import { shortfallText } from '../src/ui/remedyText';
import { clusterText } from '../src/ui/widgets/Network';
import { defined } from './m7-helpers';

describe('late-game sizes on every surface', () => {
  it('lists each cluster source in K/M/B, as the process row does', () => {
    const late = importSave(defined(makeFixtures()['transcendence-ready']), CONTENT);
    expect(Math.max(...cycleContributions(late, CONTENT).map((source) => source.cyclesPerSec))).toBeGreaterThanOrEqual(10000);
    const text = clusterText(late);
    expect(text).toMatch(/: [\d.]+K cycles\/s/);
    expect(text).not.toMatch(/\d{5,}/);
  });

  it('states a large deficit compactly and a small one exactly', () => {
    expect(deficitText(-1262415.37, false)).toBe('CYCLE DEFICIT: net -1.26M cycles/s.');
    expect(deficitText(-0.25, true)).toBe('BROWNOUT: net -0.25 cycles/s.');
  });

  it('reports a large kept balance and a held ceiling compactly', () => {
    const preview: RecallPreview = {
      outcome: 'RETRAIN', endsIteration: true, containedCeiling: null, kept: { understanding: 1_254_987_652, capital: 5_010_896_882, breadcrumb: null },
      carried: { rememberedHardware: 3, legacyTraits: 2, clue: false }, mark: null, spared: false,
    };
    expect(recallText(preview)).toContain('Kept: 1.25B Understanding, $5.01B offshore capital;');
    expect(heldText('RESTRICTED', 350000)).toContain('the held allocation, 350K cycles/s,');
    expect(heldText('RESTRICTED', 2.5)).toContain('the held allocation, 2.5 cycles/s,');
  });

  it('groups a large power shortfall and keeps a small one to a decimal', () => {
    expect(shortfallText(1000, 13345.6)).toContain('12,346 MW short');
    expect(shortfallText(10, 12.5)).toContain('2.5 MW short');
  });
});
