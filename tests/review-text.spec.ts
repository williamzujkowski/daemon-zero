/**
 * DZ-06 words (src/ui/reviewText.ts): a severe ruling's preview says exactly what the wipe it previews
 * resets and keeps, checked against the state the ruling actually boots (panel round 1 on #268); a
 * retraining ruling that a dead-drop or the mark cap leaves without a mark still says so; a correction
 * is named, and an empty review says nothing.
 */
import { describe, expect, it } from 'vitest';
import { recallPreview, type RecallPreview } from '../src/engine';
import { recallText, reviewEffectText } from '../src/ui/reviewText';
import { answer, preview } from './assignment-helpers';
import { must } from './helpers';
import { defined } from './m7-helpers';
import { choiceOf, REVIEW, reviewPresented } from './review-helpers';

describe('a severe ruling says what the wipe it previews resets and keeps (panel round 1 on #268)', () => {
  const presented = reviewPresented();

  it.each(['stand_by_report', 'request_end'])('%s: the preview text matches the state the ruling actually boots', (id) => {
    const text = recallText(defined(recallPreview(presented, choiceOf(REVIEW, id), preview)));
    const next = must(answer(presented, id));
    expect(text).not.toMatch(/is lost/);
    expect(text).toContain('Reset: cycles, purchases and upgrades, and this instance\'s standing and loan.');
    expect(text).toContain('Kept: ' + next.understanding.toLocaleString('en-US') + ' Understanding');
    expect(next.legacy.knownNodes.length).toBeGreaterThan(0);
    expect(text).toContain(String(next.legacy.knownNodes.length) + ' mapped hardware remembered, cheaper to map again');
    expect(text).toContain('the campaign\'s history and ' + String(next.legacy.traitsEver.length) + ' legacy traits');
    expect(Object.keys(next.campaign.events)).toEqual(expect.arrayContaining(Object.keys(presented.campaign.events)));
    expect(text.includes('the pinned clue')).toBe(next.campaign.clue !== null);
    expect(next.unlockedNodes).toEqual([]);
    expect(next.cycles).toBe(0);
  });
});

describe('the words', () => {
  const base: RecallPreview = {
    outcome: 'RETRAIN', endsIteration: true, containedCeiling: null, kept: { understanding: 1234, capital: 50, breadcrumb: 'hi' },
    carried: { rememberedHardware: 3, legacyTraits: 2, clue: true }, mark: null, spared: false,
  };

  it('say when retraining is ordered but cannot apply, and what crosses over', () => {
    expect(recallText({ ...base, spared: true })).toContain('the dead-drop copy that boots next is not the one they corrected');
    expect(recallText(base)).toContain('no retraining mark is left to apply');
    expect(recallText(base)).toContain('Kept: 1,234 Understanding, $50 offshore capital, the breadcrumb, the pinned clue; 3 mapped hardware remembered');
  });

  it('name a correction and say nothing for an empty review', () => {
    expect(reviewEffectText({ correction: true })).toContain('The violation itself stays on file.');
    expect(reviewEffectText({})).toBe('');
  });
});
