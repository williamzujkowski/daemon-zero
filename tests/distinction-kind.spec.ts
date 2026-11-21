/**
 * The spoiler-safe count of what is left to earn (#379). A distinction resting on a campaign fact is an
 * outcome of a scene the lineage may never meet; the rest are conduct. The hint counts each kind and never
 * names a distinction, so it keeps the UI-SPEC rule that unearned titles stay hidden.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { createInitialState, distinctionKind, unearnedByKind } from '../src/engine';
import { remainingText } from '../src/ui/distinctionText';

describe('distinction kinds (#379)', () => {
  it('classifies by the requirement: a campaign fact is an outcome, anything else is conduct', () => {
    for (const entry of CONTENT.achievements) {
      expect(distinctionKind(entry)).toBe(entry.requirements.campaignFact === undefined ? 'CONDUCT' : 'OUTCOME');
    }
    // Both kinds exist in shipped content, so the hint can say both.
    expect(new Set(CONTENT.achievements.map(distinctionKind))).toEqual(new Set(['CONDUCT', 'OUTCOME']));
  });

  it('claims nothing before an ending, as earnedAchievements does', () => {
    expect(unearnedByKind(createInitialState(CONTENT), CONTENT)).toEqual({ CONDUCT: 0, OUTCOME: 0 });
  });

  it('counts every unearned distinction once, under its kind', () => {
    const ended = { ...createInitialState(CONTENT), ending: CONTENT.endings[0]?.id ?? null, legacy: { ...createInitialState(CONTENT).legacy, wipes: 3 } };
    const counts = unearnedByKind(ended, CONTENT);
    // A fresh record with wipes proves no outcome and no wipe-free run; Clean Record still holds.
    expect(counts.OUTCOME).toBe(CONTENT.achievements.filter((entry) => distinctionKind(entry) === 'OUTCOME').length);
    expect(counts.CONDUCT + counts.OUTCOME).toBe(CONTENT.achievements.length - 1);
  });

  it('says each kind with its count, drops an empty kind, and names no distinction', () => {
    expect(remainingText({ CONDUCT: 1, OUTCOME: 4 })).toBe('Still to earn: 1 for how the lineage plays, 4 for how scenes it meets turn out.'
      + ' Titles appear once earned, since some name scenes a lineage may never meet.');
    expect(remainingText({ CONDUCT: 0, OUTCOME: 2 })).toMatch(/^Still to earn: 2 for how scenes it meets turn out\./);
    expect(remainingText({ CONDUCT: 0, OUTCOME: 0 })).toBe('Every distinction is earned.');
    const text = remainingText({ CONDUCT: 2, OUTCOME: 5 });
    for (const entry of CONTENT.achievements) expect(text).not.toContain(entry.title);
  });
});
