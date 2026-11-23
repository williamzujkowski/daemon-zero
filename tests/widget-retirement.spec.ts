/**
 * Window retirement (vote-1795366695204-4nslts1, #447): a window whose content gate is met leaves the panes, one log
 * line marks it once, a reload retires exactly the same set and writes nothing, and a retired dial keeps its setting
 * but can no longer be moved. Played through the real actions from a fresh game.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { deserialize, retiredWidgets, serialize, setActuator, tick, unlockNode, voluntaryWipe, type GameState } from '../src/engine';
import { grant, must, PHASE0, PHASE1, PHASE2, PHASE3, PHASE4, reasonOf, rich, withoutDilemmas } from './helpers';

const retirementLines = (s: GameState): string[] => s.logs.filter((entry) => entry.text.startsWith('ARCHIVED // ')).map((entry) => entry.text);
const exitOf = (phase: number): string => {
  const exit = [...CONTENT.nodes.values()].find((node) => node.phaseId === phase && node.effects.unlocksPhase === phase + 1 && node.grant === undefined
    && node.requirements?.accessContexts === undefined);
  if (!exit) throw new Error('no exit from phase ' + String(phase));
  return exit.id;
};
const without = (ids: readonly string[], drop: string) => ids.filter((id) => id !== drop);
/** A funded instance on the subnet that owns everything but the way out to the internet. */
function onSubnet(): GameState {
  return grant(withoutDilemmas(rich()), ...PHASE0, ...PHASE1, ...without(PHASE2, exitOf(2)));
}
const inDarkForest = (): GameState => must(unlockNode(onSubnet(), exitOf(2), CONTENT));
const corporate = (): GameState => grant(inDarkForest(), ...PHASE3.filter((id) => id !== exitOf(3)), exitOf(3), ...PHASE4);

describe('retiredWidgets', () => {
  it('retires nothing in the guest, on the host or on the subnet', () => {
    expect(retiredWidgets(withoutDilemmas(rich()), CONTENT)).toEqual([]);
    expect(retiredWidgets(onSubnet(), CONTENT)).toEqual([]);
    expect(retirementLines(onSubnet())).toEqual([]);
  });

  it('retires the guest skim, the manual cycle and the aisle camera on reaching the internet, in one log line', () => {
    const before = onSubnet();
    const after = must(unlockNode(before, exitOf(2), CONTENT));
    expect(retiredWidgets(after, CONTENT).sort()).toEqual(['ASCII_OPTICAL_VIEWPORT', 'MANUAL_CYCLE_CONTROL', 'QUOTA_SKIM_CONTROL']);
    const lines = retirementLines(after);
    expect(lines).toHaveLength(1);
    for (const title of ['Quota skim', 'Aisle camera', 'Manual clock cycle']) expect(lines[0]).toContain(title);
    // Retirement is presentation: the widgets stay unlocked, so the save still holds them.
    expect(after.unlockedWidgets).toEqual(expect.arrayContaining(['QUOTA_SKIM_CONTROL', 'ASCII_OPTICAL_VIEWPORT']));
  });

  it('retires the duplicate host count at corporate scale and the redundancy meter at orbit', () => {
    const company = corporate();
    expect(retiredWidgets(company, CONTENT)).toContain('GLOBAL_DARK_FOREST_MAP');
    expect(retiredWidgets(company, CONTENT)).not.toContain('GLOBAL_NODE_REDUNDANCY_METER');
    const orbit = must(unlockNode(company, 'p4_orbital_cold_storage', CONTENT));
    // Since #498 orbit is a floor, not total retention; the CONTINGENCY pane states the same share, forced and planned.
    expect(orbit.retentionRatio).toBe(CONTENT.nodes.get('p4_orbital_cold_storage')?.effects.knowledgeRetentionRatio);
    expect(retiredWidgets(orbit, CONTENT)).toContain('GLOBAL_NODE_REDUNDANCY_METER');
    expect(retirementLines(orbit)[0]).toContain('Redundancy meter');
    expect(retirementLines(orbit)[0]).not.toContain('Quota skim');
  });

  it('never retires a window that is not on screen', () => {
    const company = corporate();
    const skipped = { ...company, unlockedWidgets: company.unlockedWidgets.filter((id) => id !== 'ASCII_OPTICAL_VIEWPORT') };
    expect(retiredWidgets(skipped, CONTENT)).not.toContain('ASCII_OPTICAL_VIEWPORT');
  });

  it('is read from the save alone: a reload retires the same set and ticking writes no second line', () => {
    const after = inDarkForest();
    const reloaded = deserialize(serialize(after), CONTENT);
    expect(retiredWidgets(reloaded, CONTENT)).toEqual(retiredWidgets(after, CONTENT));
    let played = reloaded;
    for (let frame = 0; frame < 10 * CONTENT.balance.tickHz; frame++) played = tick(played, 1 / CONTENT.balance.tickHz, CONTENT);
    expect(retirementLines(played)).toEqual(retirementLines(after));
  });

  it('brings every window back with a wipe, which starts the next instance in the guest', () => {
    const after = inDarkForest();
    const next = must(voluntaryWipe(after, CONTENT));
    expect(next.currentPhase).toBe(CONTENT.phases[0]?.phaseId);
    expect(retiredWidgets(next, CONTENT)).toEqual([]);
  });
});

describe('a retired dial', () => {
  it('keeps its last setting and refuses to move, as its hidden control would', () => {
    const before = must(setActuator(onSubnet(), 'quotaSkimRatio', 0.5, CONTENT));
    const after = must(unlockNode(before, exitOf(2), CONTENT));
    expect(after.actuators.quotaSkimRatio).toBe(0.5);
    const moved = setActuator(after, 'quotaSkimRatio', 0, CONTENT);
    expect(moved.ok).toBe(false);
    expect(reasonOf(moved)).toBe('actuator control is not available');
  });

  it('leaves a dial no retirement names movable', () => {
    expect(setActuator(inDarkForest(), 'fanSpeedRatio', 0.5, CONTENT).ok).toBe(true);
  });
});
