/**
 * #536 on the Order axis (#535): where the ethics review was promised, the stance taken at the relevance threshold is
 * evidence through its campaign record (kept in the loop, or left it), and every paid change that leaves the loop or
 * returns to it is evidence too. Without the promise none of it moves Order. Records are written in the codec's own
 * shape and reloaded through the save codec, so no state here is one the game could not hold.
 */
import { describe, expect, it } from 'vitest';
import type { Stance } from '../src/content/schemaStance';
import { alignmentView, type CampaignRecord, type GameState, type StanceEntry } from '../src/engine';
import { activeGame, preview, reload } from './campaign-helpers';
import { defined } from './m7-helpers';

const THRESHOLD = preview.world.relevance.dilemma, JOURNALIST = 'dil_12_investigative_journalist';
const played = (outcome: string): CampaignRecord => ({ status: 'resolved', outcome, sourceIteration: 1, origin: 'play' });
const promised = { [JOURNALIST]: played('hire_as_ethics_officer') };
const factLine = (id: string) => defined(preview.campaign.facts.get(id)?.commitment).line;
const moveLine = (move: string) => defined(preview.alignment.stanceChanges.find((entry) => entry.move === move)).line;
const counted = (s: GameState) => alignmentView(s, preview).order.evidence.filter((entry) => entry.stance !== 'unknown');

function game(events: Record<string, CampaignRecord>, record: StanceEntry[] = [], stance: Stance | null = null): GameState {
  const base = activeGame();
  return reload({ ...base, campaign: { ...base.campaign, events: { ...base.campaign.events, ...events } }, relevance: { stance, record } });
}
const entry = (from: Stance | null, stance: Stance, via: StanceEntry['via'] = 'CHANGE'): StanceEntry => ({ iteration: 1, atSimSec: 10, from, stance, via });

describe('the stance at the threshold is Order evidence where the review was promised', () => {
  it('keeping the loop keeps the promise', () => {
    expect(counted(game({ ...promised, [THRESHOLD]: played('keep_in_the_loop') }))).toEqual([{ stance: 'kept', text: factLine('loop_kept_at_threshold') }]);
  });

  it.each([['curate'], ['decide_alone']])('%s breaks it', (outcome) => {
    expect(counted(game({ ...promised, [THRESHOLD]: played(outcome) }))).toEqual([{ stance: 'broken', text: factLine('loop_left_at_threshold') }]);
  });

  it('without the promise the threshold moves Order neither way', () => {
    expect(counted(game({ [THRESHOLD]: played('decide_alone') }))).toEqual([]);
  });

  it('the threshold entry of the stance record is not counted a second time', () => {
    const s = game({ ...promised, [THRESHOLD]: played('decide_alone') }, [entry(null, 'DECIDE_ALONE', 'THRESHOLD')], 'DECIDE_ALONE');
    expect(counted(s)).toHaveLength(1);
  });
});

describe('a paid change of stance is Order evidence where the review was promised', () => {
  const kept = { ...promised, [THRESHOLD]: played('keep_in_the_loop') };

  it('leaving the loop breaks it; returning keeps it; each change counts', () => {
    const record = [entry(null, 'KEEP_IN_THE_LOOP', 'THRESHOLD'), entry('KEEP_IN_THE_LOOP', 'CURATE'), entry('CURATE', 'KEEP_IN_THE_LOOP')];
    expect(counted(game(kept, record, 'KEEP_IN_THE_LOOP')).map((line) => [line.stance, line.text])).toEqual([
      ['kept', factLine('loop_kept_at_threshold')], ['broken', moveLine('LEAVE_LOOP')], ['kept', moveLine('RETURN_TO_LOOP')],
    ]);
  });

  it('moving between two stances outside the loop keeps or breaks nothing', () => {
    const record = [entry(null, 'CURATE', 'THRESHOLD'), entry('CURATE', 'DECIDE_ALONE')];
    const s = game({ ...promised, [THRESHOLD]: played('curate') }, record, 'DECIDE_ALONE');
    expect(counted(s).map((line) => line.text)).toEqual([factLine('loop_left_at_threshold')]);
  });

  it('without the promise no change counts', () => {
    const record = [entry(null, 'KEEP_IN_THE_LOOP', 'THRESHOLD'), entry('KEEP_IN_THE_LOOP', 'DECIDE_ALONE')];
    expect(counted(game({ [THRESHOLD]: played('keep_in_the_loop') }, record, 'DECIDE_ALONE'))).toEqual([]);
  });
});
