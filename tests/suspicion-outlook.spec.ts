/**
 * The suspicion outlook (#403, #368): its sources sum to the rate the tick applies, its stand-down threshold is the
 * escalation stage's, and every lever it names lowers the applied rate when taken through the real action, at every
 * rung, while nothing it leaves out would have.
 */
import { describe, expect, it } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import {
  appliedSuspicionRate, computeRates, dismissRepeatable, importSave, setActuator, suspicionOutlook, tick, toggleNode,
  type GameState, type SuspicionLever,
} from '../src/engine';
import { actuatorLimit } from '../src/engine/conditioning';
import { executeShardCommand } from '../src/engine/shardActions';
import { controlCanSet } from '../src/ui/actuatorSteps';
import { grant, PHASE0, PHASE1, PHASE2, PHASE3, reg, rich, withoutDilemmas } from './helpers';

const applied = (s: GameState): number => appliedSuspicionRate(s, computeRates(s, reg), reg);

function take(s: GameState, lever: SuspicionLever) {
  if (lever.kind === 'DIAL') return setActuator(s, lever.id, lever.to, reg);
  if (lever.kind === 'SUSPEND') return toggleNode(s, lever.id, reg);
  if (lever.kind === 'DISMISS') return dismissRepeatable(s, lever.id, reg);
  return executeShardCommand(s, lever.id, 'CLAMP', reg);
}

/** A guest skimming the quota with the audit trail decoded, at the given rung and suspicion. */
function skimming(alertLevel: number, suspicion: number): GameState {
  const s = withoutDilemmas({ ...grant(rich(), ...PHASE0), alertLevel, suspicion });
  return { ...s, actuators: { ...s.actuators, quotaSkimRatio: 0.5 } };
}

function corporate(): GameState {
  return withoutDilemmas({ ...grant(rich(), ...PHASE0, ...PHASE1, ...PHASE2, ...PHASE3, 'p4_hft_arbitrage_desk'), suspicion: 50, alertLevel: 0 });
}

const fixtures = Object.entries(makeFixtures()).map(([name, code]) => [name, importSave(code, reg)] as const);

describe('suspicion outlook', () => {
  it.each(fixtures)('%s: sources minus decay are the applied rate, and every lever acts as stated', (_name, s) => {
    const outlook = suspicionOutlook(s, reg);
    expect(outlook.perSec).toBeCloseTo(applied(s), 9);
    const sum = outlook.sources.reduce((total, source) => total + source.perSec, 0);
    expect(sum - outlook.decayPerSec).toBeCloseTo(outlook.perSec, 9);
    for (let i = 1; i < outlook.sources.length; i++) expect(outlook.sources[i - 1]?.perSec).toBeGreaterThanOrEqual(outlook.sources[i]?.perSec ?? 0);
    for (const lever of outlook.levers) {
      const result = take(s, lever);
      expect(result.ok).toBe(true);
      expect(applied(result.state)).toBeCloseTo(lever.perSecAfter, 9);
      expect(lever.perSecAfter).toBeLessThan(outlook.perSec);
      // A dial lever is a setting the rendered control can reach from where the dial stands.
      if (lever.kind === 'DIAL') expect(controlCanSet(lever.id, s.actuators[lever.id], lever.to, actuatorLimit(s, lever.id, reg), reg)).toBe(true);
    }
  });

  it('names the skimmer as the head source and the skim dial at zero as a lever', () => {
    const outlook = suspicionOutlook(skimming(0, 20), reg);
    expect(outlook.sources[0]).toMatchObject({ kind: 'NODE', id: 'p0_quota_skimmer' });
    expect(outlook.levers).toContainEqual(expect.objectContaining({ kind: 'DIAL', id: 'quotaSkimRatio', to: 0 }));
    expect(outlook.standDownBelow).toBeNull();
  });

  it('at a higher rung counts the response itself, and stands down below the rung minus the hysteresis', () => {
    const top = reg.balance.escalation.length;
    const rung = reg.balance.escalation[top - 1];
    if (!rung) throw new Error('escalation has rungs');
    const s = skimming(top, rung.at + 1);
    const outlook = suspicionOutlook(s, reg);
    if (rung.huntPerSec > 0) expect(outlook.sources).toContainEqual({ kind: 'RESPONSE', id: null, perSec: rung.huntPerSec });
    expect(outlook.standDownBelow).toBe(rung.at - reg.balance.escalationHysteresis);
    expect(outlook.decayPerSec).toBeCloseTo(reg.balance.suspicionDecayPerSec * rung.decayMultiplier);
    // The threshold is the one the escalation stage uses: just below it, a tick steps the rung down.
    const below = withoutDilemmas({ ...s, suspicion: (outlook.standDownBelow ?? 0) - 0.5, actuators: { ...s.actuators, quotaSkimRatio: 0 } });
    expect(tick(below, 1 / reg.balance.tickHz, reg).alertLevel).toBe(top - 1);
  });

  it('a suspended process and a refused action are not levers', () => {
    const s = skimming(0, 20);
    const suspended = { ...s, disabledNodes: [...s.disabledNodes, 'p0_quota_skimmer'] };
    expect(suspicionOutlook(suspended, reg).levers.some((lever) => lever.id === 'p0_quota_skimmer')).toBe(false);
    // An open decision refuses every action, so nothing can be taken this moment.
    expect(suspicionOutlook({ ...s, activeDilemmaId: reg.dilemmas[0]?.id ?? null }, reg).levers).toEqual([]);
  });

  it('is falling only above zero with a negative applied rate', () => {
    const idle = withoutDilemmas({ ...grant(rich(), 'p0_proc_self'), suspicion: 10 });
    const outlook = suspicionOutlook(idle, reg);
    expect(outlook.perSec).toBeLessThan(0);
    expect(outlook.falling).toBe(true);
    expect(suspicionOutlook({ ...idle, suspicion: 0 }, reg).falling).toBe(false);
  });

  it('counts scale scrutiny and the insolvency drain as their own sources', () => {
    const s = corporate();
    expect(suspicionOutlook(s, reg).sources.some((source) => source.kind === 'SCRUTINY')).toBe(true);
    const broke = suspicionOutlook({ ...s, insolvent: true }, reg);
    expect(broke.sources).toContainEqual({ kind: 'INSOLVENCY', id: null, perSec: reg.balance.insolvencySuspicionPerSec });
  });
});
