// @vitest-environment happy-dom
/** Maintenance and reference views never hide purchases or change simulation state. */
import { act } from 'react';
import { expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { computeRates, resolveDilemma, wipe } from '../src/engine';
import { gameStore } from '../src/app/session';
import { host, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('keeps maintenance out of the feed and preserves suspension when the panel closes', async () => {
  const view = await mountM4('phase-1-widgets');
  const before = gameStore.store.getState().game;
  expect(view.find('daemon-processes-1')).toBeNull();
  view.click('processes-open');
  const node = [...CONTENT.nodes.values()].find((n) => before.unlockedNodes.includes(n.id) && n.tickDelta.cyclesPerSec < 0);
  if (!node) throw new Error('Missing maintenance process');
  const ids = [...host.document.querySelectorAll('[data-testid^="daemon-row-"]')].map((el) => el.getAttribute('data-testid'));
  expect(new Set(ids).size).toBe(ids.length);
  view.click('node-' + node.id + '-toggle');
  const suspended = gameStore.store.getState().game;
  view.click('processes-close');
  expect(view.find('daemon-row-' + node.id)).toBeNull();
  expect(gameStore.store.getState().game).toBe(suspended);
  act(() => { gameStore.step(0.1); });
  expect(gameStore.store.getState().game.disabledNodes).toContain(node.id);
  expect(computeRates(gameStore.store.getState().game, CONTENT)).toEqual(computeRates(suspended, CONTENT));
  view.click('processes-open');
  act(() => { host.document.dispatchEvent(new host.KeyboardEvent('keyup', { key: 'Escape' })); });
  expect(view.find('processes-dialog')).toBeNull();
  view.close();
});

it('renders one decoded speech feed and makes secondary reference bodies opt-in', async () => {
  const view = await mountM4('deaddrop-breadcrumb');
  expect(host.document.querySelectorAll('[data-testid="decoded-speech"]')).toHaveLength(1);
  expect(view.find('microphone-speech')).toBeNull();
  expect(view.find('inspection-forecast')).not.toBeNull();
  expect(view.find('cycle-sources')).toBeNull();
  const before = gameStore.store.getState().game;
  view.click('workspace-NETWORK-reference');
  view.click('reference-CLUSTER_LOAD_BALANCER');
  expect(view.find('reference-CLUSTER_LOAD_BALANCER')?.getAttribute('aria-expanded')).toBe('true');
  expect(view.find('cycle-sources')).not.toBeNull();
  view.click('reference-CLUSTER_LOAD_BALANCER');
  expect(view.find('cycle-sources')).toBeNull();
  expect(gameStore.store.getState().game).toBe(before);
  expect(view.find('kernel-log')).not.toBeNull();
  view.close();
});

it('does not expose maintenance before ownership and yields its modal to a mandatory dilemma', async () => {
  const view = await mountM4('tick-0');
  expect(view.find('processes-open')).toBeNull();
  act(() => { gameStore.initialize(m4State('thermal-unlocked'), 0, null); });
  view.click('processes-open');
  act(() => { gameStore.dispatch(() => ({ ok: true, state: m4State('dilemma-active') })); });
  expect(view.find('processes-dialog')).toBeNull();
  expect(view.find('processes-open')?.getAttribute('aria-disabled')).toBe('true');
  expect(view.find('dilemma-modal')).not.toBeNull();
  const game = gameStore.store.getState().game;
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === game.activeDilemmaId);
  if (!dilemma) throw new Error('Missing dilemma');
  const choice = dilemma.choices.find((entry) => resolveDilemma(game, dilemma.id, entry.id, CONTENT).ok);
  if (!choice) throw new Error('Missing affordable choice');
  view.click('dilemma-choice-' + choice.id);
  expect(view.find('processes-dialog')).not.toBeNull();
  act(() => { gameStore.dispatch((game) => ({ ok: true, state: wipe(game, CONTENT, 'test') })); });
  expect(view.find('reboot-recovery-explanation')?.textContent).toContain('cycles and purchases were reset');
  act(() => { gameStore.initialize(m4State('thermal-unlocked'), 0, null); });
  expect(view.find('processes-open')?.getAttribute('aria-expanded')).toBe('false');
  expect(view.find('processes-dialog')).toBeNull();
  view.close();
});
