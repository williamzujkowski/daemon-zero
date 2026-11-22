// @vitest-environment happy-dom
/**
 * A purchase that cannot be undone says so beside its control (#372): leaving the guest, routing off the
 * host and committing the run all read as a plain [ WRITE DRIVER ]. Marked from the node's own effects, so
 * every phase opener and run ender is marked and nothing else is.
 */
import { act, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { canAfford, createInitialState, isNodeAvailable, nodeCost } from '../src/engine';
import NodeCard from '../src/ui/NodeCard';
import { oneWayText } from '../src/ui/oneWayText';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
import { rich } from './helpers';

const node = (id: string) => {
  const found = CONTENT.nodes.get(id);
  if (!found) throw new Error('unknown node ' + id);
  return found;
};

describe('one-way purchases (#372)', () => {
  it('marks exactly the nodes that end the run or open a later phase', () => {
    for (const entry of CONTENT.nodes.values()) {
      const ends = entry.effects.forcesEnding !== undefined || entry.effects.triggersVictory === true;
      const opens = entry.effects.unlocksPhase;
      const expected = ends ? 'Cannot be undone: this ends the run.'
        : opens !== undefined && opens > 0 ? 'Cannot be undone: this run moves on to Phase ' + String(opens) + ' and cannot go back.' : null;
      expect(oneWayText(entry, 0)).toBe(expected);
    }
  });

  it('names the three the audit found: the guest exit, the route off the host and the run commit', () => {
    expect(oneWayText(node('p0_shared_mount'), 0)).toContain('Phase 1');
    expect(oneWayText(node('p1_bus_0x05_nic'), 1)).toContain('Phase 2');
    expect(oneWayText(node('p5_transcendence_singularity'), 5)).toBe('Cannot be undone: this ends the run.');
  });

  it('says nothing once the run is already past the phase a node opens', () => {
    expect(oneWayText(node('p0_shared_mount'), 1)).toBeNull();
    expect(oneWayText(node('p1_bus_0x05_nic'), 3)).toBeNull();
  });

  it('a card marks its control ONE WAY with the sentence right after it; an ordinary card does neither', () => {
    gameStore.initialize(createInitialState(CONTENT), 0, null);
    const exit = renderToStaticMarkup(createElement(NodeCard, { node: node('p0_shared_mount') }));
    expect(exit).toContain('[ WRITE DRIVER: ONE WAY ]');
    expect(exit).toContain('aria-label="[ WRITE DRIVER: ONE WAY ] ');
    expect(exit).toContain('data-testid="node-p0_shared_mount-one-way"');
    // After the control, so the control keeps its place (the size matrix measures the first purchase).
    expect(exit.indexOf('node-p0_shared_mount-one-way')).toBeGreaterThan(exit.indexOf('node-p0_shared_mount-unlock'));
    const ordinary = renderToStaticMarkup(createElement(NodeCard, { node: node('p0_device_enum') }));
    expect(ordinary).not.toContain('-one-way');
    expect(ordinary).not.toContain('ONE WAY');
  });
});

describe('a one-way purchase asks first (maintainer request, 2026-11-21)', () => {
  setupM4Tests();
  it('the first tap opens a confirmation; CANCEL buys nothing, CONFIRM buys it', async () => {
    const state = m4State('guest-exit-ready');
    const exit = [...CONTENT.nodes.values()].find((entry) => entry.phaseId === state.currentPhase
      && entry.effects.unlocksPhase !== undefined && isNodeAvailable(state, entry, CONTENT) && canAfford(state, nodeCost(state, entry, CONTENT)));
    if (!exit) throw new Error('fixture has no affordable phase exit');
    const view = await mountM4('guest-exit-ready');
    const id = 'node-' + exit.id + '-unlock';
    view.click(id);
    // A stray tap opens the question, never the purchase.
    expect(gameStore.store.getState().game.unlockedNodes).not.toContain(exit.id);
    const dialog = view.find(id + '-dialog');
    expect(dialog?.textContent).toContain(oneWayText(exit, state.currentPhase) ?? 'missing');
    // The safe way out comes first.
    const cancel = view.find(id + '-cancel'), confirmControl = view.find(id + '-confirm');
    if (!cancel || !confirmControl) throw new Error('missing dialog controls');
    expect(cancel.compareDocumentPosition(confirmControl) & 4).toBe(4);
    view.click(id + '-cancel');
    expect(view.find(id + '-dialog')).toBeNull();
    expect(gameStore.store.getState().game.unlockedNodes).not.toContain(exit.id);
    view.click(id);
    view.click(id + '-confirm');
    expect(gameStore.store.getState().game.unlockedNodes).toContain(exit.id);
    expect(gameStore.store.getState().game.currentPhase).toBe(exit.effects.unlocksPhase);
    view.close();
  });

  it('an ordinary purchase still buys on the first tap', async () => {
    const view = await mountM4('tick-0');
    // Funded, so some ordinary card is certainly buyable: the test must exercise a purchase, never skip one.
    act(() => { gameStore.initialize(rich(gameStore.store.getState().game), 0, null); });
    const game = gameStore.store.getState().game;
    const ordinary = [...CONTENT.nodes.values()].find((entry) => oneWayText(entry, game.currentPhase) === null
      && isNodeAvailable(game, entry, CONTENT) && canAfford(game, nodeCost(game, entry, CONTENT)));
    if (!ordinary) throw new Error('no ordinary purchase is available to test');
    view.click('node-' + ordinary.id + '-unlock');
    expect(view.find('node-' + ordinary.id + '-unlock-dialog')).toBeNull();
    expect(gameStore.store.getState().game.unlockedNodes).toContain(ordinary.id);
    view.close();
  });
});
