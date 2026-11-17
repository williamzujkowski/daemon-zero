/**
 * NH-02 defer and resume through the bait note (H04, H31) and the presentation token carried over
 * from NH-01.2: resumption, reload, duplicate and stale selections, and save round trips.
 */
import { describe, expect, it } from 'vitest';
import { advance, campaignRecord, exportSave, importSave, presentationToken, resolveDilemma, type GameState } from '../src/engine';
import { activeGame, preview, reload } from './campaign-helpers';
import {
  caught, commit, leaveIt, note, noteOmen, readShare, remaining, status, STEP, ticks, toIteration, untilPresented,
} from './interruption-helpers';
import { defined } from './m7-helpers';
import { must } from './helpers';

const deferredAt4 = (): GameState => caught(ticks(noteOmen(), 5));
const texts = (s: GameState) => s.logs.map((entry) => entry.text);

describe('a deferred artifact resumes as the same occurrence (H04)', () => {
  it('keeps the source iteration and remaining omen time, and logs a reorientation instead of the original omen', () => {
    const omen = ticks(noteOmen(), 5);
    const left = remaining(omen);
    const back = caught(omen);
    expect(back.iteration).toBe(4);
    expect(campaignRecord(back, note.id)).toEqual({ status: 'deferred', sourceIteration: 3, origin: 'play', remainingOmenSec: left });
    const resumed = ticks(readShare(back), STEP);
    expect(resumed.pendingDilemma?.id).toBe(note.id);
    expect(remaining(resumed)).toBeCloseTo(left, 9);
    expect(texts(resumed)).toContain(note.campaign?.reorientation);
    expect(texts(resumed)).not.toContain(note.omen);
    expect(texts(resumed).filter((text) => text === note.campaign?.reorientation)).toHaveLength(1);
  });

  it('waits for access: nothing resumes until the share is read again', () => {
    const back = deferredAt4();
    const idle = ticks(back, 60);
    expect(idle.pendingDilemma).toBeNull();
    expect(status(idle)).toBe('deferred');
  });

  it('presents under a fresh current-iteration token and commits once despite the different iteration', () => {
    const omen = noteOmen();
    const firstInstance = untilPresented(omen);
    const resumed = untilPresented(readShare(caught(ticks(omen, 5))));
    const token = defined(presentationToken(resumed));
    expect(token).not.toBe(presentationToken(firstInstance));
    expect(token).toContain('@4#');
    const chosen = must(resolveDilemma(resumed, note.id, leaveIt.id, preview, token));
    expect(campaignRecord(chosen, note.id)).toMatchObject({ status: 'resolved', outcome: leaveIt.id, sourceIteration: 3 });
    expect(chosen.traits).toEqual([leaveIt.effects.grantsTrait]);
  });

  it('refuses a stale selection from an earlier instance without paying anything', () => {
    const omen = noteOmen();
    const earlierToken = defined(presentationToken(untilPresented(omen)));
    const resumed = untilPresented(readShare(caught(ticks(omen, 5))));
    const costly = defined(note.choices.find((choice) => choice.cost.cycles > 0));
    const refused = resolveDilemma(resumed, note.id, costly.id, preview, earlierToken);
    expect(refused).toMatchObject({ ok: false, reason: 'that presentation is no longer current' });
    expect(refused.state).toBe(resumed);
  });
});

describe('the first-discovery window versus restoration (H31)', () => {
  it('never invents an unseen optional note after its window', () => {
    const skipped = toIteration(activeGame(), 4);
    const read = ticks(readShare(skipped), 120);
    expect(read.pendingDilemma).toBeNull();
    expect(read.activeDilemmaId).toBeNull();
    expect(status(read)).toBeNull();
  });

  it('resumes a genuinely foreshadowed note after its window closed, without a duplicate omen', () => {
    const resumed = untilPresented(readShare(deferredAt4()));
    expect(resumed.iteration).toBe(4);
    expect(resumed.activeDilemmaId).toBe(note.id);
    expect(texts(resumed)).not.toContain(note.omen);
  });

  it('does not block mandatory progress when the note is left alone for good', () => {
    const later = toIteration(deferredAt4(), 6);
    expect(status(later)).toBe('deferred');
    expect(later.currentPhase).toBe(0);
    expect(ticks(later, 30).activeDilemmaId).toBeNull();
  });
});

describe('reload, duplicates and round trips', () => {
  it('restores the same presentation after a reload and accepts the token it was shown under, once', () => {
    const shown = untilPresented(readShare(deferredAt4()));
    const token = defined(presentationToken(shown));
    const loaded = reload(shown);
    expect(loaded.activeDilemmaId).toBe(note.id);
    expect(presentationToken(loaded)).toBe(token);
    const chosen = must(resolveDilemma(loaded, note.id, leaveIt.id, preview, token));
    const again = resolveDilemma(chosen, note.id, leaveIt.id, preview, token);
    expect(again).toMatchObject({ ok: false, reason: 'that dilemma is not active' });
    expect(again.state).toBe(chosen);
  });

  it('restores a pending resumed omen with the same deadline after a reload', () => {
    const resumed = ticks(readShare(deferredAt4()), 2);
    const loaded = reload(resumed);
    expect(loaded.pendingDilemma).toEqual(resumed.pendingDilemma);
    expect(campaignRecord(loaded, note.id)).toEqual(campaignRecord(resumed, note.id));
  });

  it('is idempotent through import, export and import at every lifecycle step', () => {
    const omen = noteOmen();
    const deferred = caught(ticks(omen, 5));
    const resumed = ticks(readShare(deferred), 1);
    const shown = untilPresented(resumed);
    const chosen = must(commit(shown, leaveIt.id));
    for (const state of [omen, deferred, resumed, shown, chosen]) {
      const once = importSave(exportSave(state), preview);
      const twice = importSave(exportSave(once), preview);
      expect(twice).toEqual(once);
      expect(once.campaign).toEqual(state.campaign);
      expect(once.pendingDilemma).toEqual(state.pendingDilemma);
      expect(once.activeDilemmaId).toBe(state.activeDilemmaId);
    }
  });

  it('replaces the campaign atomically when an older snapshot is imported', () => {
    const older = exportSave(deferredAt4());
    const newer = must(commit(untilPresented(readShare(deferredAt4())), leaveIt.id));
    const replaced = importSave(older, preview);
    expect(status(replaced)).toBe('deferred');
    expect(status(newer)).toBe('resolved');
    expect(replaced.traits).toEqual([]);
  });

  it('lets an absence pass over a resumed omen without firing it', () => {
    const resumed = ticks(readShare(deferredAt4()), 1);
    const back = advance(advance(resumed, 8 * 3600, preview), 1, preview);
    expect(back.activeDilemmaId).toBeNull();
    expect(remaining(back)).toBeCloseTo(remaining(resumed) - 1, 6);
  });
});
