/**
 * NH-03.7 (H30): an ordinary breakout return under campaign rules, with the early incidents
 * already spent. The unchanged GREEDY bot plays three wipes on the preview registry; no early
 * incident is met twice, no record is lost, and later iterations still progress and are still
 * caught by the ordinary threat mechanics. SIM evidence, not play.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { activateCampaignRules, createInitialState } from '../src/engine';
import { MIN_WIPE_TRANSITIONS, runWipeSequence, type WipeSequenceReport } from '../src/engine/sim/iterations';
import { GREEDY_POLICY } from '../src/engine/sim/policy';
import { preview } from './campaign-helpers';
import { must } from './helpers';

// A hard cap that keeps the sequence finite, not a pacing target. On main the fourth iteration was
// caught 97 s before a 4 h cap; NH-06's Elena follow-up adds about a minute to the second
// iteration, so 4 h cut the fourth off before its ordinary wipe. 4.5 h leaves room for that.
const SEQUENCE_SEC = 4.5 * 3600;
// A full four-iteration replay under coverage on a shared CI runner; simulated-time limits are separate.
const SLOW_MS = 60_000;

describe('a breakout return with the early incidents exhausted (H30)', () => {
  let run: WipeSequenceReport;
  beforeAll(() => {
    const start = must(activateCampaignRules(createInitialState(preview), preview));
    run = runWipeSequence(preview, GREEDY_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: SEQUENCE_SEC, initialState: start });
  }, SLOW_MS);

  it('meets each once-per-campaign event in at most one iteration', () => {
    expect(run.completed).toBe(true);
    const met = run.iterations.flatMap((entry) => entry.dilemmasMet.filter((id) => preview.campaign.events.has(id)));
    expect(met.length).toBeGreaterThan(5);
    expect(new Set(met).size).toBe(met.length);
    for (const id of met) expect(run.finalState.campaign.events[id]).toMatchObject({ status: 'resolved' });
  });

  it('keeps later iterations playable: they reach the network phase and end by an ordinary threat', () => {
    for (const entry of run.iterations.slice(1)) {
      expect(entry.endedBy).toBe('wipe');
      expect(entry.wipeCause).not.toBeNull();
      expect(entry.phaseReachedAfterSec[2]).toBeGreaterThan(0);
    }
  });

  it('pays the early story bounties only once: the first return earns less from stories than a legacy one', () => {
    const legacy = runWipeSequence(preview, GREEDY_POLICY, { wipeTransitions: MIN_WIPE_TRANSITIONS, maxSimSec: SEQUENCE_SEC });
    expect(run.iterations[0]).toEqual(legacy.iterations[0]);
    const rewards = (report: WipeSequenceReport) => report.iterations.slice(1).reduce((sum, entry) => sum + entry.storyRewards.cycles, 0);
    expect(rewards(run)).toBeLessThan(rewards(legacy));
  }, SLOW_MS);
});
