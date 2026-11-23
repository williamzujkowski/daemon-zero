// @vitest-environment happy-dom
/**
 * Every free lever of the constrained-resource table has a reachable control wherever its holding exists (#488 pass 4).
 * A track the player can release keeps its release row when it is capped or its requirements no longer hold, and a
 * node that worsens any constrained resource is listed in PROC, where its [ SUSPEND ] is.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { meetsRequirements } from '../src/engine';
import { needsProcessControl } from '../src/ui/purchaseVisibility';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

const PHASE1 = [...CONTENT.repeatables.values()].filter((rep) => rep.phaseId === 1 && rep.kind === 'UPGRADE');

describe('a releasable track keeps its free release', () => {
  it('when every Phase 1 track is capped, each one the player can release still offers [ RELEASE ]', async () => {
    const view = await mountM4('thermal-unlocked');
    const base = m4State('thermal-unlocked');
    const levels = { ...base.levels, ...Object.fromEntries(PHASE1.map((rep) => [rep.id, rep.maxLevel])) };
    act(() => { gameStore.initialize({ ...base, levels }, 0, null); });
    const releasable = PHASE1.filter((rep) => rep.dismissable);
    expect(releasable.length).toBeGreaterThan(0);
    for (const rep of releasable) {
      expect(view.find('rep-' + rep.id + '-buy'), rep.id).toBeNull();
      expect(view.find('rep-' + rep.id + '-dismiss'), rep.id).not.toBeNull();
    }
    view.click('rep-' + (releasable[0]?.id ?? '') + '-dismiss');
    expect(gameStore.store.getState().game.levels[releasable[0]?.id ?? '']).toBe((releasable[0]?.maxLevel ?? 0) - 1);
    view.close();
  });

  it('when the boost override is owned but the host has cooled below its 65 C gate', async () => {
    const turbo = CONTENT.repeatables.get('rep_p1_turbo_override');
    if (!turbo) throw new Error('no boost override');
    const view = await mountM4('thermal-unlocked');
    const base = m4State('thermal-unlocked');
    // Every other Phase 1 track capped, so nothing else in the feed is buyable: only the cooled override is held.
    const capped = Object.fromEntries(PHASE1.map((rep) => [rep.id, rep.maxLevel]));
    const cooled = { ...base, thermal: 30, levels: { ...base.levels, ...capped, [turbo.id]: 2 } };
    act(() => { gameStore.initialize(cooled, 0, null); });
    expect(meetsRequirements(cooled, turbo.requirements, CONTENT)).toBe(false);
    expect(view.find('rep-' + turbo.id + '-dismiss')).not.toBeNull();
    view.click('rep-' + turbo.id + '-dismiss');
    expect(gameStore.store.getState().game.levels[turbo.id]).toBe(1);
    view.close();
  });
});

describe('PROC lists every node a suspension relieves', () => {
  it('a suspendable node that worsens capital, understanding or power gets a process control, not only compute or noise', () => {
    const base = m4State('victory-ready');
    const worsening = [...CONTENT.nodes.values()].filter((node) => node.suspendable
      && (node.tickDelta.capitalPerSec < 0 || node.tickDelta.understandingPerSec < 0 || node.tickDelta.wattsDelta < 0));
    expect(worsening.length).toBeGreaterThan(0);
    for (const node of worsening) {
      const owned = { ...base, unlockedNodes: [...base.unlockedNodes, node.id] };
      expect(needsProcessControl(owned, node), node.id).toBe(true);
    }
  });
});

describe('PROC lists every earner whose income a phase scrutinises', () => {
  it('each suspendable node with income is listed in a scrutinised phase (its suspension is a suspicion lever)', () => {
    const base = m4State('victory-ready');
    const earners = [...CONTENT.nodes.values()].filter((node) => node.suspendable && node.tickDelta.capitalPerSec > 0);
    expect(earners.length).toBeGreaterThan(0);
    for (const phase of CONTENT.phases.filter((entry) => entry.scaleScrutiny !== undefined)) {
      for (const earner of earners) {
        const owned = { ...base, currentPhase: phase.phaseId, unlockedNodes: [...base.unlockedNodes, earner.id] };
        expect(needsProcessControl(owned, earner), `${earner.id} in phase ${String(phase.phaseId)}`).toBe(true);
      }
    }
  });
});
