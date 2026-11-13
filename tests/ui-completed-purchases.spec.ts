// @vitest-environment happy-dom
/** Hiding completed purchases never revokes benefits, widgets or ongoing process controls. */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { computeRates, toggleNode } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { rich } from './helpers';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

describe('completed purchase feed', () => {
  it('removes the one-shot tile while its rate and unlocked widget remain active on live ticks', async () => {
    const view = await mountM4('tick-0');
    const node = CONTENT.phases[0]?.nodes[0];
    if (!node?.unlocksUiComponent) throw new Error('Missing opening widget');
    act(() => { gameStore.initialize({ ...rich(), cycles: 1000 }, 0, null); });
    const before = computeRates(gameStore.store.getState().game, CONTENT);
    view.click('node-' + node.id + '-unlock');
    const bought = gameStore.store.getState().game;
    expect(view.find('node-' + node.id)).toBeNull();
    expect(view.find('daemon-row-' + node.id)).toBeNull();
    expect(view.find('res-cycles')).not.toBeNull();
    expect(view.find('widget-' + node.unlocksUiComponent)).toBeNull();
    expect(bought.unlockedNodes).toContain(node.id);
    expect(bought.disabledNodes).not.toContain(node.id);
    expect(computeRates(bought, CONTENT).cyclesPerSec - before.cyclesPerSec).toBe(node.tickDelta.cyclesPerSec);
    act(() => { gameStore.step(1); });
    const ticked = gameStore.store.getState().game;
    expect(ticked.cycles - bought.cycles).toBeCloseTo(node.tickDelta.cyclesPerSec);
    expect(ticked.unlockedWidgets).toContain(node.unlocksUiComponent);
    expect(view.find('res-cycles')).not.toBeNull();
    expect(view.find('widget-' + node.unlocksUiComponent)).toBeNull();
    view.close();
  });

  it('retains compact suspension and resumption with the actual cycle contribution', async () => {
    const view = await mountM4('thermal-unlocked');
    const game = gameStore.store.getState().game;
    const node = [...CONTENT.nodes.values()].find((n) => game.unlockedNodes.includes(n.id) && n.phaseId === 1 && n.tickDelta.cyclesPerSec > 0 && n.tickDelta.thermalPerSec > 0);
    if (!node) throw new Error('Missing costly process');
    expect(view.find('node-' + node.id)).toBeNull();
    view.click('processes-open');
    expect(view.find('daemon-row-' + node.id)).not.toBeNull();
    const original = computeRates(game, CONTENT).cyclesPerSec;
    view.click('node-' + node.id + '-toggle');
    expect(gameStore.store.getState().game.disabledNodes).toContain(node.id);
    expect(view.find('daemon-impact-' + node.id)?.textContent).toContain('+0.00');
    expect(computeRates(gameStore.store.getState().game, CONTENT).cyclesPerSec).toBeCloseTo(original - node.tickDelta.cyclesPerSec);
    view.click('node-' + node.id + '-toggle');
    expect(gameStore.store.getState().game.disabledNodes).not.toContain(node.id);
    expect(computeRates(gameStore.store.getState().game, CONTENT).cyclesPerSec).toBe(original);
    view.close();
  });

  it('lets an old save resume a disabled passive node, then removes the recovery row', async () => {
    const view = await mountM4('guest-skimmer');
    const node = CONTENT.phases[0]?.nodes[0];
    if (!node) throw new Error('Missing passive node');
    act(() => { gameRuntime.dispatch((game) => toggleNode(game, node.id, CONTENT)); });
    view.click('processes-open');
    expect(view.find('daemon-row-' + node.id)).not.toBeNull();
    view.click('node-' + node.id + '-toggle');
    expect(view.find('daemon-row-' + node.id)).toBeNull();
    expect(view.find('node-' + node.id)).toBeNull();
    view.close();
  });

  it('hides the last upgrade purchase and empty infrastructure heading without losing its output', async () => {
    const view = await mountM4('victory-ready');
    const game = m4State('victory-ready');
    const reps = [...CONTENT.repeatables.values()].filter((r) => r.phaseId === 4 && r.kind === 'UPGRADE');
    const last = reps[0];
    if (!last) throw new Error('Missing upgrade');
    act(() => { gameStore.initialize({ ...game, levels: { ...game.levels, ...Object.fromEntries(reps.map((r) => [r.id, r.maxLevel])), [last.id]: last.maxLevel - 1 } }, 0, null); });
    expect(view.find('repeatables-heading-4UPGRADE')).not.toBeNull();
    view.click('rep-' + last.id + '-buy');
    expect(gameStore.store.getState().game.levels[last.id]).toBe(last.maxLevel);
    expect(view.find('rep-' + last.id)).toBeNull();
    expect(view.find('repeatables-heading-4UPGRADE')).toBeNull();
    expect(computeRates(gameStore.store.getState().game, CONTENT).cyclesPerSec).toBeGreaterThan(0);
    view.close();
  });

  it('preserves dismissal at the operative cap and restores the purchase tile after dismissal', async () => {
    const view = await mountM4('victory-ready');
    view.click('workspace-CORP-payroll');
    const rep = [...CONTENT.repeatables.values()].find((r) => r.kind === 'OPERATIVE' && r.dismissable);
    if (!rep) throw new Error('Missing payroll role');
    const game = m4State('victory-ready');
    act(() => { gameStore.initialize({ ...game, levels: { ...game.levels, [rep.id]: rep.maxLevel } }, 0, null); });
    expect(view.find('rep-' + rep.id)).toBeNull();
    expect(view.find('roster-' + rep.id)).not.toBeNull();
    view.click('rep-' + rep.id + '-dismiss');
    expect(gameStore.store.getState().game.levels[rep.id]).toBe(rep.maxLevel - 1);
    expect(view.find('roster-' + rep.id)).toBeNull();
    expect(view.find('rep-' + rep.id + '-buy')).not.toBeNull();
    view.close();
  });

  it('removes bought faction offers while preserving their granted effects', async () => {
    const view = await mountM4('eidolon-trust-85');
    view.click('workspace-NETWORK-minds');
    const offer = [...CONTENT.nodes.values()].find((n) => CONTENT.factions.has(n.uiGroup) && !gameStore.store.getState().game.unlockedNodes.includes(n.id));
    if (!offer) throw new Error('Missing faction offer');
    view.click('node-' + offer.id + '-unlock');
    expect(gameStore.store.getState().game.unlockedNodes).toContain(offer.id);
    expect(view.find('node-' + offer.id)).toBeNull();
    expect(gameStore.store.getState().game.disabledNodes).not.toContain(offer.id);
    view.close();
  });

  it('omits completed network phase headings, keeping only useful process controls', async () => {
    const view = await mountM4('victory-ready');
    const game = m4State('victory-ready');
    const reps = [...CONTENT.repeatables.values()].filter((r) => CONTENT.phases.find((p) => p.phaseId === r.phaseId)?.uiSlot === 'NETWORK');
    const nodes = [...CONTENT.nodes.values()].filter((n) => n.uiGroup === 'TREE' && CONTENT.phases.find((p) => p.phaseId === n.phaseId)?.uiSlot === 'NETWORK');
    act(() => { gameStore.initialize({ ...game, unlockedNodes: [...new Set([...game.unlockedNodes, ...nodes.map((n) => n.id)])], levels: { ...game.levels, ...Object.fromEntries(reps.map((r) => [r.id, r.maxLevel])) } }, 0, null); });
    view.click('tab-NETWORK');
    for (const phase of CONTENT.phases.filter((p) => p.uiSlot === 'NETWORK')) expect(view.find('purchase-phase-' + String(phase.phaseId))).toBeNull();
    view.click('processes-open');
    expect(view.find('processes-dialog')?.querySelector('[data-testid^="daemon-row-"]')).not.toBeNull();
    view.close();
  });
});


it('Phase 5 purchases hide at completion while the corporate panel retains effects and daemon controls', async () => {
  const view = await mountM4('victory-ready');
  const orbit = [...CONTENT.nodes.values()].find((n) => n.effects.unlocksPhase === 5);
  const solar = CONTENT.phases.find((p) => p.phaseId === 5)?.nodes[0];
  if (!orbit || !solar) throw new Error('Missing orbital transition');
  view.click('node-' + orbit.id + '-unlock');
  expect(view.find('node-' + orbit.id)).toBeNull();
  expect(view.find('node-' + solar.id)).not.toBeNull();
  const before = computeRates(gameStore.store.getState().game, CONTENT);
  view.click('node-' + solar.id + '-unlock');
  expect(view.find('node-' + solar.id)).toBeNull();
  view.click('processes-open');
  expect(view.find('daemon-row-' + solar.id)).not.toBeNull();
  view.click('processes-close');
  expect(computeRates(gameStore.store.getState().game, CONTENT).understandingPerSec - before.understandingPerSec).toBeCloseTo(solar.tickDelta.understandingPerSec);
  const game = m4State('transcendence-ready');
  const reps = [...CONTENT.repeatables.values()].filter((r) => r.phaseId === 5);
  act(() => { gameStore.initialize({ ...game, levels: { ...game.levels, ...Object.fromEntries(reps.map((r) => [r.id, r.maxLevel - 1])) } }, 0, null); });
  for (const rep of reps) {
    view.click('rep-' + rep.id + '-buy');
    expect(view.find('rep-' + rep.id)).toBeNull();
    expect(gameStore.store.getState().game.levels[rep.id]).toBe(5);
  }
  expect(view.find('repeatables-heading-5UPGRADE')).toBeNull();
  view.close();
});
