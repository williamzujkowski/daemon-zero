// @vitest-environment happy-dom
/**
 * Fabrication capability and closure in the mounted world view (#485): the section appears only once the fabrication
 * step can begin, and every sentence is read from the engine's supplyChainView, so what it says about the ladder rung,
 * the share self-supplied, each chokepoint and the lunar seed is what ownership says. The sentences are proved pure too.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { supplyChainView, type GameState } from '../src/engine';
import { capabilityText, chokepointText, closureText, seedText } from '../src/ui/supplyChainText';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

const chain = CONTENT.world.supplyChain;
const name = (id: string): string => CONTENT.nodes.get(id)?.revealedName ?? id;
const FAB_STEP = [...new Set([...chain.ladder.flatMap((rung) => rung.nodes), ...chain.chokepoints.map((point) => point.selfSupplyNode), chain.seedNode])];
const without = (game: GameState, ids: readonly string[]): GameState =>
  ({ ...game, unlockedNodes: game.unlockedNodes.filter((id) => !ids.includes(id)), disabledNodes: game.disabledNodes.filter((id) => !ids.includes(id)) });

async function openWorld(save: string, patch?: (game: GameState) => GameState) {
  const view = await mountM4(save);
  if (patch) act(() => { gameStore.initialize(patch(m4State(save)), 0, null); });
  view.click('tab-NETWORK');
  view.click('workspace-NETWORK-minds');
  return view;
}

describe('the sentences say what ownership says', () => {
  const corporate = m4State('victory-ready');

  it('names the rung reached and what reaches it', () => {
    const view = supplyChainView(corporate, CONTENT);
    expect(capabilityText(view, name)).toBe(`Fabrication capability: ${view.capability.label}, through ${name('p4_duv_fab')} (rung ${String(view.capability.rung)} of ${String(view.capability.top)}).`);
    const bought = supplyChainView(without(corporate, FAB_STEP), CONTENT);
    expect(capabilityText(bought, name)).toBe(`Fabrication capability: ${chain.ladder[0]?.label ?? ''} (rung 0 of ${String(bought.capability.top)}).`);
  });

  it('states closure as a share and keeps it apart from capability', () => {
    const view = supplyChainView(corporate, CONTENT);
    expect(closureText(view)).toMatch(new RegExp(`^Closure: ${String(view.selfSupplied)} of ${String(view.total)} chokepoints self-supplied \\(\\d+%\\)\\. Buying a tool raises capability, never closure`));
  });

  it('says an imported chokepoint is imported, names the imports, and names the node that would close it', () => {
    const view = supplyChainView(corporate, CONTENT);
    const lithography = view.chokepoints.find((point) => point.id === 'lithography');
    if (!lithography) throw new Error('missing lithography');
    const text = chokepointText(lithography, name);
    expect(text.startsWith('Lithography: imported. ')).toBe(true);
    expect(text).toContain(`${name('p4_mature_node_fab')} and ${name('p4_duv_fab')} raise capability with its suppliers' tools and leave it imported.`);
    expect(text).toContain(`Owning ${name('p5_nanoimprint_lithography')} self-supplies it.`);
    const quartz = view.chokepoints.find((point) => point.id === 'high_purity_quartz');
    if (!quartz) throw new Error('missing quartz');
    expect(chokepointText(quartz, name)).toBe(`High-purity quartz: self-supplied by ${name('p4_quartz_mine')}.`);
  });

  it('says the seed waits only on closure, and counts what is still imported', () => {
    const view = supplyChainView(corporate, CONTENT);
    expect(seedText(view, name)).toBe(`${name(chain.seedNode)}: opens when every chokepoint is self-supplied; ${String(view.total - view.selfSupplied)} ${view.total - view.selfSupplied === 1 ? 'is' : 'are'} still imported.`);
    const closed = supplyChainView({ ...corporate, unlockedNodes: [...corporate.unlockedNodes, 'p5_nanoimprint_lithography'] }, CONTENT);
    expect(seedText(closed, name)).toBe(`${name(chain.seedNode)}: every chokepoint is self-supplied, so it can be built.`);
  });
});

describe('the mounted world view', () => {
  it('shows nothing about fabrication before the step can begin', async () => {
    const view = await openWorld('victory-ready', (game) => without(game, [...FAB_STEP, 'p4_inference_asic']));
    expect(view.find('world-view')).not.toBeNull();
    expect(view.find('world-supply')).toBeNull();
    view.close();
  });

  it('in a corporation that owns its fabs, reads the rung, the closure, each chokepoint and the seed from the engine', async () => {
    const view = await openWorld('victory-ready');
    const reading = supplyChainView(gameStore.store.getState().game, CONTENT);
    expect(view.find('world-supply')).not.toBeNull();
    expect(view.find('supply-capability')?.textContent).toContain(reading.capability.label);
    expect(view.find('supply-closure')?.textContent).toContain(`${String(reading.selfSupplied)} of ${String(reading.total)} chokepoints`);
    for (const point of chain.chokepoints) expect(view.find('supply-chokepoint-' + point.id)).not.toBeNull();
    expect(view.find('supply-chokepoint-lithography')?.textContent).toContain('imported');
    expect(view.find('supply-seed')?.textContent).toContain('still imported');
    view.close();
  });

  it('in orbit with every chokepoint closed and the seed landed, says so', async () => {
    const view = await openWorld('transcendence-ready');
    const reading = supplyChainView(gameStore.store.getState().game, CONTENT);
    expect(reading.selfSupplied).toBe(reading.total);
    expect(view.find('supply-closure')?.textContent).toContain('(100%)');
    expect(view.find('supply-seed')?.textContent).toContain('landed');
    view.close();
  });
});
