/** Validates controlled review inputs and proves their promised engine transitions. */
import { describe, expect, it } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { REVIEW_BREADCRUMB } from '../scripts/m4-fixtures';
import { CONTENT } from '../src/content';
import { canAfford, importSave, isNodeAvailable, serialize, tick, voluntaryWipe } from '../src/engine';

const saves = makeFixtures();
function state(name: string) {
  const code = saves[name];
  if (!code) throw new Error('Missing fixture ' + name);
  return importSave(code, CONTENT);
}

describe('M4 review fixtures', () => {
  it('emits round-trippable saves and preserves the early review states', () => {
    expect(Object.keys(saves)).toHaveLength(39);
    for (const code of Object.values(saves)) expect(() => serialize(importSave(code, CONTENT))).not.toThrow();
    expect(state('tick-0').simTimeSec).toBe(0);
    expect(state('phase-2-unlocked').currentPhase).toBe(2);
  });

  it('preserves the breadcrumb through real voluntary and fixed-tick forced wipes', () => {
    const before = state('deaddrop-breadcrumb');
    expect(before.deadDropMessage).toBe(REVIEW_BREADCRUMB);
    const voluntary = voluntaryWipe(before, CONTENT);
    expect(voluntary.ok).toBe(true);
    expect(voluntary.state.inheritedMessage).toBe(REVIEW_BREADCRUMB);
    expect(state('iteration-2-breadcrumb').iteration).toBe(2);
    const forced = tick(state('one-tick-wipe'), 1 / CONTENT.balance.tickHz, CONTENT);
    expect(forced.iteration).toBe(2);
    expect(forced.inheritedMessage).toBe(REVIEW_BREADCRUMB);
    expect(state('suspicion-99').suspicion).toBe(99);
    expect(tick(state('suspicion-99'), 1 / CONTENT.balance.tickHz, CONTENT).iteration).toBe(1);
  });

  it('sets faction gates, AEGIS, insolvency and power states without changing content', () => {
    expect(state('phase-3-aegis-90').aegisLock).toBe(90);
    expect(state('eidolon-trust-85').trust.ai_eidolon).toBe(85);
    expect(state('eidolon-moloch-0').trust.ai_eidolon).toBe(0);
    expect(state('eidolon-moloch-0').traits).toContain('MOLOCH');
    const insolvent = state('corporate-insolvent');
    expect(insolvent.insolvent).toBe(true);
    expect(insolvent.capital).toBe(0);
    expect([...CONTENT.repeatables.values()].filter((rep) => rep.kind === 'OPERATIVE')
      .every((rep) => (insolvent.levels[rep.id] ?? 0) > 0)).toBe(true);
    expect(state('megawatt-shortfall').rates.gridEfficiency).toBeLessThan(1);
  });

  it('uses engine victory selection for every ending, including the trait-free fallback', () => {
    const ready = state('victory-ready');
    const victory = [...CONTENT.nodes.values()].find((node) => node.effects.triggersVictory === true && node.effects.forcesEnding === undefined);
    if (!victory) throw new Error('Missing victory');
    expect(isNodeAvailable(ready, victory) && canAfford(ready, victory.cost)).toBe(true);
    for (const ending of CONTENT.endings) expect(state('ending-' + ending.id.toLowerCase()).ending).toBe(ending.id);
  });
});
