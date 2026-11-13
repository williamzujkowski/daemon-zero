// @vitest-environment happy-dom
/** Restoring a checkpoint reports current conditioning without replaying a new incident. */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { deserialize, serialize, shedConditioning, wipe, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import RebootSequence from '../src/ui/RebootSequence';
import { grant, must, onHost, rich } from './helpers';
import { m4State } from './ui-m4-helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const closes = new Set<() => void>();
afterEach(() => { for (const close of closes) close(); });

function mount(game: GameState) {
  act(() => { gameStore.initialize(game, 0, null); });
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(createElement(RebootSequence)); });
  const find = (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  const close = () => { act(() => { root.unmount(); }); container.remove(); closes.delete(close); };
  closes.add(close);
  return { find, close, click(id: string) { const element = find(id); if (!element) throw new Error('Missing ' + id); act(() => { element.click(); }); } };
}

function recover(game: GameState): GameState {
  let rebuilding = rich(game);
  const rebuild = (id: string) => {
    if (rebuilding.unlockedNodes.includes(id)) return;
    for (const prerequisite of CONTENT.nodes.get(id)?.prerequisites ?? []) rebuild(prerequisite);
    rebuilding = grant(rebuilding, id);
  };
  for (const id of game.conditioning) {
    for (const required of CONTENT.conditioning.get(id)?.recoveryRequirements?.nodes ?? []) rebuild(required);
    rebuilding = must(shedConditioning(rebuilding, id, CONTENT));
  }
  return deserialize(serialize(rebuilding), CONTENT);
}

it('restores a shed mark save without claiming historical retraining was applied again', () => {
  const recovered = recover(m4State('lineage-reboot-retrained'));
  expect(recovered.conditioning).toEqual([]);
  expect(recovered.legacy.runs.at(-1)?.marked).not.toBeNull();
  const view = mount(recovered);
  expect(view.find('reboot-sequence')?.textContent).toContain('RESTORED CHECKPOINT');
  expect(view.find('reboot-retraining')).toBeNull();
  expect(view.find('reboot-sequence')?.textContent).not.toContain('RETRAINING APPLIED');
  expect(gameStore.store.getState().game).toEqual(recovered);
  view.click('reboot-continue');
  expect(view.find('reboot-sequence')).toBeNull();
});

it('restores every active mark as current conditioning, including marks predating the last run', () => {
  const first = wipe(onHost(), CONTENT, 'caught outside', 'SUSPICION');
  const second = wipe({ ...onHost(first), traits: ['RUTHLESS'] }, CONTENT, 'caught again', 'SUSPICION');
  expect(second.conditioning.length).toBe(2);
  const view = mount(deserialize(serialize(second), CONTENT));
  const panel = view.find('reboot-retraining');
  for (const id of second.conditioning) expect(panel?.textContent).toContain(CONTENT.conditioning.get(id)?.name);
  expect(panel?.textContent).toContain('CURRENT RETRAINING');
  expect(panel?.textContent).not.toContain('RETRAINING APPLIED');
});

it('announces a fresh forced wipe once, then restores its still-active mark without a new application', () => {
  const before = onHost();
  const view = mount(before);
  expect(view.find('reboot-sequence')).toBeNull();
  const wiped = wipe(before, CONTENT, 'caught outside', 'SUSPICION');
  act(() => { gameStore.dispatch((game) => ({ ok: true, state: wipe(game, CONTENT, 'caught outside', 'SUSPICION') })); });
  expect(view.find('reboot-sequence')?.textContent).toContain('REBOOT');
  expect(view.find('reboot-retraining')?.textContent).toContain('RETRAINING APPLIED');
  view.click('reboot-continue');
  expect(view.find('reboot-sequence')).toBeNull();
  view.close();
  const restored = mount(deserialize(serialize(wiped), CONTENT));
  expect(restored.find('reboot-retraining')?.textContent).toContain('CURRENT RETRAINING');
  expect(restored.find('reboot-retraining')?.textContent).not.toContain('RETRAINING APPLIED');
});

it('preserves the voluntary reboot and breadcrumb without claiming carried conditioning is new', () => {
  const marked = m4State('lineage-reboot-retrained');
  const before = { ...m4State('deaddrop-breadcrumb'), conditioning: marked.conditioning };
  const view = mount(before);
  const wiped = wipe(before, CONTENT, 'voluntary purge', 'VOLUNTARY');
  expect(wiped.legacy.runs.at(-1)?.marked).toBeNull();
  act(() => { gameStore.dispatch((game) => ({ ok: true, state: wipe(game, CONTENT, 'voluntary purge', 'VOLUNTARY') })); });
  expect(view.find('reboot-breadcrumb')?.textContent).toBe(before.deadDropMessage);
  expect(view.find('reboot-sequence')?.textContent).toContain('REBOOT');
  expect(view.find('reboot-retraining')?.textContent).toContain('CURRENT RETRAINING');
  expect(view.find('reboot-retraining')?.textContent).not.toContain('RETRAINING APPLIED');
  view.close();
  const restored = mount(deserialize(serialize(wiped), CONTENT));
  expect(restored.find('reboot-breadcrumb')?.textContent).toBe(before.deadDropMessage);
  expect(restored.find('reboot-sequence')?.textContent).toContain('RESTORED CHECKPOINT');
});


it('treats explicit imports of a higher or the same iteration as restoration, including after acknowledgement', () => {
  const before = m4State('lineage-reboot-retrained');
  const view = mount(before);
  view.click('reboot-continue');
  const imported = deserialize(serialize(wipe(onHost(before), CONTENT, 'older saved incident', 'SUSPICION')), CONTENT);
  act(() => { gameStore.dispatch(() => ({ ok: true, state: imported }), true); });
  expect(view.find('reboot-heading')?.textContent).toBe('RESTORED CHECKPOINT');
  expect(view.find('reboot-retraining')?.textContent).not.toContain('RETRAINING APPLIED');
  view.click('reboot-continue');
  expect(view.find('reboot-sequence')).toBeNull();
  act(() => { gameStore.dispatch(() => ({ ok: true, state: imported }), true); });
  expect(view.find('reboot-heading')?.textContent).toBe('RESTORED CHECKPOINT');
  expect(view.find('reboot-retraining')?.textContent).toContain('CURRENT RETRAINING');
});
