// @vitest-environment happy-dom
/**
 * A purchase that cannot be undone says so beside its control (#372): leaving the guest, routing off the
 * host and committing the run all read as a plain [ WRITE DRIVER ]. Marked from the node's own effects, so
 * every phase opener and run ender is marked and nothing else is.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { createInitialState } from '../src/engine';
import NodeCard from '../src/ui/NodeCard';
import { oneWayText } from '../src/ui/oneWayText';

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

  it('a card shows the line above its control, and an ordinary card shows none', () => {
    gameStore.initialize(createInitialState(CONTENT), 0, null);
    const exit = renderToStaticMarkup(createElement(NodeCard, { node: node('p0_shared_mount') }));
    expect(exit).toContain('data-testid="node-p0_shared_mount-one-way"');
    expect(exit.indexOf('node-p0_shared_mount-one-way')).toBeLessThan(exit.indexOf('node-p0_shared_mount-unlock'));
    const ordinary = renderToStaticMarkup(createElement(NodeCard, { node: node('p0_device_enum') }));
    expect(ordinary).not.toContain('-one-way');
  });
});
