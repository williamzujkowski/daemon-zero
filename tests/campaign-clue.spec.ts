/**
 * NH-02 clue and reorientation at the public seams: only disclosed records can be pinned, only a
 * supported dead-drop carries one, it grants nothing, progression never needs it (H21, H22), and
 * Start Fresh clears it with the rest of the campaign (H27).
 */
import { describe, expect, it } from 'vitest';
import { createGameStore } from '../src/app/store';
import {
  activateCampaignRules, campaignRecord, clueView, createInitialState, pinClue, pinnableClues, reorientation, wipe, type GameState,
} from '../src/engine';
import { activeGame, cryo, pgrant, preview } from './campaign-helpers';
import {
  caught, commit, cryoOmen, leaveIt, note, noteOmen, readShare, stableThroughReloads, status, STEP, ticks, untilPresented,
} from './interruption-helpers';
import { must, PHASE0, PHASE1, PHASE2, reasonOf, rich } from './helpers';

const DEAD_DROP = PHASE2.slice(0, 4);
const withDeadDrop = (s: GameState): GameState => {
  const missing = [...PHASE0, ...PHASE1, ...DEAD_DROP].filter((id) => !s.unlockedNodes.includes(id));
  return { ...pgrant(s, ...missing), resolvedDilemmas: s.resolvedDilemmas };
};
/** Iteration 3 with the dead-drop owned and the note's omen just logged. */
const noteOmenWithDrop = (): GameState => {
  const omen = noteOmen();
  return readShare(withDeadDrop(omen));
};
const lines = (s: GameState) => reorientation(s, preview).map((line) => line.text);
const bootTexts = (s: GameState) => s.logs.map((entry) => entry.text);
const without = (s: GameState) => ({ ...s, campaign: { ...s.campaign, clue: null } });

describe('pinning one disclosed clue (H21, H22)', () => {
  it('offers only records this instance has seen or recovered', () => {
    const chosenEarlier = must(commit(untilPresented(cryoOmen()), cryo.choices[0]?.id ?? '', cryo.id));
    expect(pinnableClues(chosenEarlier, preview)).toEqual([cryo.id]);
    const rebooted = rich(wipe(chosenEarlier, preview, 'test', 'VOLUNTARY'));
    expect(campaignRecord(rebooted, cryo.id)?.status).toBe('resolved');
    expect(pinnableClues(rebooted, preview)).toEqual([]);
    // Its recovered record is readable once this instance holds the decoder again.
    expect(pinnableClues(withDeadDrop(rebooted), preview)).toEqual([cryo.id]);
  });

  it('refuses a record this instance cannot see, such as an incident another instance lost', () => {
    const lostEarlier = withDeadDrop(caught(cryoOmen()));
    expect(campaignRecord(lostEarlier, cryo.id)?.status).toBe('interrupted');
    expect(pinnableClues(lostEarlier, preview)).toEqual([]);
    expect(reasonOf(pinClue(lostEarlier, cryo.id, preview))).toBe('that record is not disclosed to this instance');
    expect(reasonOf(pinClue(lostEarlier, 'dil_no_such_event', preview))).toBe('that record is not disclosed to this instance');
  });

  it('pins a foreshadowed note and changes nothing but the pin', () => {
    const omen = noteOmenWithDrop();
    expect(pinnableClues(omen, preview)).toEqual([note.id]);
    const pinned = must(pinClue(omen, note.id, preview));
    expect(pinned.campaign.clue).toEqual({ event: note.id, pinnedAtIteration: 3 });
    // Pinned now, it is not yet a retained clue: only a wipe it survives makes it one.
    expect(lines(pinned)).toEqual([]);
    expect(without(pinned)).toEqual(omen);
    expect(pinClue(pinned, note.id, preview).state).toBe(pinned);
    expect(must(pinClue(pinned, null, preview)).campaign.clue).toBeNull();
    expect(clueView(pinned, note.id, preview)).toEqual({ event: note.id, title: note.title, status: preview.campaign.labels.foreshadowed });
  });

  it('refuses without a dead-drop, under legacy rules and after the run ended', () => {
    expect(reasonOf(pinClue(noteOmen(), note.id, preview))).toBe('no dead-drop available');
    const legacy = withDeadDrop(rich(createInitialState(preview)));
    expect(reasonOf(pinClue(legacy, note.id, preview))).toBe('campaign history is not available');
    expect(pinnableClues(legacy, preview)).toEqual([]);
    expect(reasonOf(pinClue({ ...noteOmenWithDrop(), ending: 'THE_ARK' }, note.id, preview))).toBe('the run has ended');
  });
});

describe('carrying the clue across a wipe', () => {
  it('keeps it through a supported dead-drop and offers a reorientation and an honest lead', () => {
    const pinned = must(pinClue(noteOmenWithDrop(), note.id, preview));
    const back = caught(pinned);
    expect(back.campaign.clue).toEqual({ event: note.id, pinnedAtIteration: 3 });
    const labels = preview.campaign.labels;
    expect(lines(back)).toEqual([
      `RETAINED_CLUE: ${note.title} // ${labels.deferred}`,
      `NEXT_LEAD: ${note.campaign?.lead ?? ''}`,
    ]);
    expect(bootTexts(back)).toEqual(expect.arrayContaining(lines(back)));
    // Pinned and carried clues both leave saves that reload unchanged.
    expect(stableThroughReloads(pinned).campaign).toEqual(pinned.campaign);
    expect(stableThroughReloads(back).campaign).toEqual(back.campaign);
    expect(lines(stableThroughReloads(back))).toEqual(lines(back));
  });

  it('loses it on a wipe without a supported dead-drop', () => {
    const back = caught(must(pinClue(noteOmenWithDrop(), note.id, preview)));
    const again = caught(back);
    expect(again.campaign.clue).toBeNull();
    expect(lines(again)).toEqual([]);
    expect(status(again)).toBe('deferred');
  });

  it('grants nothing: a wipe with the clue keeps exactly what one without it keeps', () => {
    const omen = noteOmenWithDrop();
    const plain = caught(omen), carried = caught(must(pinClue(omen, note.id, preview)));
    expect({ ...without(carried), logs: [], logSeq: 0 }).toEqual({ ...plain, logs: [], logSeq: 0 });
  });

  it('never makes progression depend on the clue: both returns reach the same decision by reading the share', () => {
    const omen = noteOmenWithDrop();
    const plain = untilPresented(readShare(caught(omen)));
    const carried = untilPresented(readShare(caught(must(pinClue(omen, note.id, preview)))));
    expect(plain.activeDilemmaId).toBe(note.id);
    expect(carried.activeDilemmaId).toBe(note.id);
    expect(lines(caught(omen))).toEqual([]);
  });

  it('reports what the record establishes as it changes, never a verdict it lacks', () => {
    const labels = preview.campaign.labels;
    const carried = caught(must(pinClue(noteOmenWithDrop(), note.id, preview)));
    const answered = must(commit(untilPresented(readShare(carried)), leaveIt.id));
    expect(lines(answered)).toEqual([`RETAINED_CLUE: ${note.title} // Answered: ${leaveIt.label}.`]);
    const cryoPinned = must(pinClue(withDeadDrop(ticks(cryoOmen(), STEP)), cryo.id, preview));
    expect(lines(caught(cryoPinned))).toEqual([`RETAINED_CLUE: ${cryo.title} // ${labels.interrupted}`]);
  });
});

describe('Start Fresh (H27)', () => {
  it('clears campaign records and the clue through the store path Start Fresh uses', () => {
    const store = createGameStore(preview);
    const carried = caught(must(pinClue(noteOmenWithDrop(), note.id, preview)));
    store.initialize(carried, 0, null);
    expect(store.store.getState().game.campaign.clue).not.toBeNull();
    store.dispatch(() => ({ ok: true, state: createInitialState(preview) }));
    const fresh = store.store.getState().game;
    expect(fresh.campaign).toEqual({ ...must(activateCampaignRules(createInitialState(preview), preview)).campaign });
    expect(fresh.campaign.clue).toBeNull();
    expect(fresh.campaign.events).toEqual({});
    expect(activeGame().campaign.clue).toBeNull();
  });
});
