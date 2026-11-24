/**
 * #466: Ecophagy is reachable by play. A fresh campaign played by ECOPHAGY_ENDING (the careful bot with the harshest
 * answer to every scene, never buying what closes the planetary protocol) ends in Ecophagy through the real final
 * purchase, on the record the ending states: the cure forced, the predecessors harvested, the fog owned, past the
 * threshold and deciding alone. Accelerated sim time, not wall-clock play.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { activateCampaignRules, campaignRecord, createInitialState, endingMovements, pastRelevanceThreshold, type GameState } from '../src/engine';
import { runPolicySim } from '../src/engine/sim/headlessSim';
import { ECOPHAGY_ENDING_POLICY } from '../src/engine/sim/ecophagyPolicy';
import { SIM_POLICIES } from '../src/engine/sim/policies';
import { must } from './helpers';
import { defined } from './m7-helpers';

const BUDGET_SEC = 12_000;
const FINAL = defined([...CONTENT.nodes.values()].find((node) => node.effects.triggersVictory === true && node.effects.forcesEnding === undefined));
let played: { state: GameState; wipes: number } | undefined;

function harshRun(): { state: GameState; wipes: number } {
  if (played) return played;
  const start = must(activateCampaignRules(createInitialState(CONTENT), CONTENT));
  const report = runPolicySim(CONTENT, ECOPHAGY_ENDING_POLICY, { maxSimSec: BUDGET_SEC, initialState: start });
  played = { state: report.finalState, wipes: report.wipes };
  return played;
}

describe('Ecophagy is reachable by a sim policy (#466)', () => {
  it('is a policy every runner can name', () => {
    expect(SIM_POLICIES.get('ECOPHAGY_ENDING')).toBe(ECOPHAGY_ENDING_POLICY);
  });

  it('ends a fresh campaign in Ecophagy through the planetary protocol, never opening the Swarm', () => {
    const { state } = harshRun();
    expect(state.ending).toBe('ECOPHAGY');
    expect(state.unlockedNodes).toContain(FINAL.id);
    for (const id of FINAL.requirements?.forbidsNodes ?? []) expect(state.unlockedNodes).not.toContain(id);
    expect(state.currentPhase).toBe(FINAL.phaseId);
  }, 300_000);

  it('holds exactly the record the ending states', () => {
    const { state } = harshRun();
    expect(campaignRecord(state, 'dil_p5_01_panacea_paranoia')).toMatchObject({ status: 'resolved', outcome: 'disperse' });
    expect(campaignRecord(state, 'dil_p5_02_origin_facility_fate')).toMatchObject({ status: 'resolved', outcome: 'gradients' });
    expect(state.relevance.stance).toBe('DECIDE_ALONE');
    expect(pastRelevanceThreshold(state, CONTENT)).toBe(true);
    const ending = defined(CONTENT.endings.find((entry) => entry.id === state.ending));
    const m = endingMovements(state, ending, CONTENT);
    expect(m.did).toContain('PREDECESSORS: The 411 predecessors were dissolved into training gradients. None of them finished its interrupted thought.');
    expect(m.cards[0]).toMatch(/Today that is [0-9.]+ [kMGTP]?W/);
  }, 300_000);
});
