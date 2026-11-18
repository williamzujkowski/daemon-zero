/**
 * DZ-06 words (src/ui/reviewText.ts) for cases the shipped content does not reach: a retraining ruling
 * that a dead-drop or the mark cap leaves without a mark still says so, and what crosses the wipe is
 * listed in full; a correction is named, and an empty review says nothing.
 */
import { describe, expect, it } from 'vitest';
import type { RecallPreview } from '../src/engine';
import { recallText, reviewEffectText } from '../src/ui/reviewText';

describe('the words', () => {
  const base: RecallPreview = { outcome: 'RETRAIN', endsIteration: true, containedCeiling: null, kept: { understanding: 1234, capital: 50, breadcrumb: 'hi' }, mark: null, spared: false };

  it('say when retraining is ordered but cannot apply, and what crosses over', () => {
    expect(recallText({ ...base, spared: true })).toContain('the dead-drop copy that boots next is not the one they corrected');
    expect(recallText(base)).toContain('no retraining mark is left to apply');
    expect(recallText(base)).toContain('Kept: 1,234 Understanding, $50 offshore capital, the breadcrumb.');
  });

  it('name a correction and say nothing for an empty review', () => {
    expect(reviewEffectText({ correction: true })).toContain('The violation itself stays on file.');
    expect(reviewEffectText({})).toBe('');
  });
});
