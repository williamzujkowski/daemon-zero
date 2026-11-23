// @vitest-environment happy-dom
/**
 * Storage and network coupling on screen (#484): the cluster shows each discounted source's effective rate of its raw
 * rate and a total line, a remembered card states a raw rate as raw and what arrives, PROC shows storage held against
 * capacity beside the control that frees it, and the units note explains storage and, once a discounted source is
 * owned, coupling.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { unlockNode, type GameState } from '../src/engine';
import { nodeUtilityText } from '../src/ui/format';
import { clusterText } from '../src/ui/widgets/Network';
import { fixtureState } from './fallback-states';
import { mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

const funded = (s: GameState): GameState => ({ ...s, cycles: 1e30, understanding: 1e30, capital: 1e30, memoryCap: s.memoryCap + 1e30 });
function owning(s: GameState, ...ids: string[]): GameState {
  return ids.reduce((state, id) => {
    const result = unlockNode(funded(state), id, CONTENT);
    if (!result.ok) throw new Error(`${id}: ${result.reason}`);
    return result.state;
  }, s);
}
const node = (id: string) => { const found = CONTENT.nodes.get(id); if (!found) throw new Error(id); return found; };

describe('raw and effective compute (#484)', () => {
  it('the cluster totals effective of raw and says what arrives of each discounted source', () => {
    const s = owning(fixtureState(3), 'p3_botnet_mesh', 'p3_edge_npu_swarm');
    const lines = clusterText(s).split('\n');
    expect(lines[0]).toMatch(/^Effective \S+ [kMGTPEZY]?FLOP\/s of \S+ [kMGTPEZY]?FLOP\/s raw$/);
    expect(lines).toContain('Edge NPU Harvest (Phones & Laptops): 210 PFLOP/s of 35 EFLOP/s raw');
  });

  it('a co-located cluster reads as it always did: no raw figures, no total line', () => {
    const lines = clusterText(fixtureState(2)).split('\n');
    expect(lines.some((line) => line.includes('raw'))).toBe(false);
  });

  it('a remembered card states the raw rate as raw and what arrives, and a link node what it raises', () => {
    expect(nodeUtilityText(node('p3_edge_npu_swarm'), true, 0)).toContain('Rate: +35 EFLOP/s (raw; 210 PFLOP/s arrives (2% available × 30% coupling, consumer links))');
    expect(nodeUtilityText(node('p4_dci_dark_fibre'), true, 0)).toContain('sites joined by data-centre interconnect couple at 95% while it runs');
    expect(nodeUtilityText(node('p1_nlp_lexicon'), true, 0)).toContain('holds 512 GB of storage while it runs');
    expect(nodeUtilityText(node('p1_bus_0x05_nic'), true, 0)).toContain('+256 TB storage');
  });
});

describe('storage in PROC and the units note (#484)', () => {
  it('PROC shows storage held against capacity, and the data row says what suspending frees', async () => {
    const view = await mountM4('tick-0');
    act(() => { gameStore.initialize(owning(fixtureState(1), 'p1_nlp_lexicon'), 0, null); });
    view.click('processes-open');
    expect(view.find('processes-storage')?.textContent).toBe('Storage: 0.5 / 2 TB held');
    expect(view.find('daemon-impact-p1_nlp_lexicon')?.textContent).toContain('512 GB stored');
    expect(view.find('node-p1_nlp_lexicon-toggle')?.getAttribute('aria-label')).toContain('and free 48 MB of memory and 512 GB of storage');
    view.close();
  });

  it('the units note separates storage from memory, and explains coupling only once a discounted source is owned', async () => {
    const view = await mountM4('tick-0');
    act(() => { gameStore.initialize(fixtureState(2), 0, null); });
    view.click('reference-units');
    const before = view.find('units-note')?.textContent ?? '';
    expect(before).toContain('Storage is disk, tape and archive');
    expect(before).not.toContain('coupling');
    act(() => { gameStore.initialize(owning(fixtureState(3), 'p3_botnet_mesh', 'p3_edge_npu_swarm'), 0, null); });
    // A new phase mounts its own CORE pane, so the fold starts closed again.
    if (view.find('reference-units')?.getAttribute('aria-expanded') === 'false') view.click('reference-units');
    const after = view.find('units-note')?.textContent ?? '';
    expect(after).toContain('Effective compute is raw compute times availability times coupling');
    expect(after).toContain('distributed hosts and edge devices on consumer links 30%');
    expect(after).toContain('design parameters, not measurements');
    view.close();
  });
});
