// @vitest-environment happy-dom
/** Restores and fresh starts must discard transient events from the replaced run. */
import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { createInitialState, exportSave, wipe } from '../src/engine';
import { importPlayerSave } from '../src/app/saveTransfer';
import { gameRuntime, gameStore } from '../src/app/session';
import { grant, rich } from './helpers';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

async function reclaimedView() {
  const view = await mountM4('lineage-reboot-retrained');
  if (view.find('reboot-continue')) view.click('reboot-continue');
  let game = rich(gameStore.store.getState().game);
  const mark = CONTENT.conditioning.get(game.conditioning[0] ?? '');
  if (!mark) throw new Error('Missing active mark');
  const rebuild = (id: string) => {
    if (game.unlockedNodes.includes(id)) return;
    for (const prerequisite of CONTENT.nodes.get(id)?.prerequisites ?? []) rebuild(prerequisite);
    game = grant(game, id);
  };
  for (const id of mark.recoveryRequirements?.nodes ?? []) rebuild(id);
  act(() => { gameStore.initialize(game, 0, null); });
  if (view.find('reboot-continue')) view.click('reboot-continue');
  view.click('cond-' + mark.id + '-shed');
  expect(view.find('conditioning-reclaimed')?.textContent).toContain(mark.name);
  return view;
}

it('clears an unacknowledged reclaimed capability when Start Fresh replaces the run', async () => {
  const view = await reclaimedView();
  view.click('save-open'); view.click('save-reset'); view.click('save-reset-confirm');
  expect(gameStore.store.getState().game).toEqual(createInitialState(CONTENT));
  expect.soft(view.find('conditioning-reclaimed')).toBeNull();
  expect.soft(view.find('conditioning')).toBeNull();
  view.close();
});

it.each(['phase-1-widgets', 'response-paged'])('does not invent progression notices when importing same-iteration %s', async (fixture) => {
  const view = await mountM4('tick-0');
  const imported = m4State(fixture);
  expect(imported.iteration).toBe(gameStore.store.getState().game.iteration);
  act(() => { expect(importPlayerSave(exportSave(imported)).ok).toBe(true); });
  expect(gameStore.store.getState().game).toEqual(imported);
  expect.soft(view.find('phase-threshold')).toBeNull();
  expect.soft(view.find('lineage-reveal')).toBeNull();
  expect.soft(view.find('response-notice')).toBeNull();
  view.close();
});


it('keeps reclaimed feedback on ordinary ticks but clears it on a real live wipe', async () => {
  const view = await reclaimedView();
  const acknowledged = view.find('conditioning-reclaimed');
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  expect(view.find('conditioning-reclaimed')).toBe(acknowledged);
  act(() => { expect(gameRuntime.dispatch((game) => ({ ok: true, state: wipe(game, CONTENT, 'voluntary restart', 'VOLUNTARY') })).ok).toBe(true); });
  expect(view.find('conditioning-reclaimed')).toBeNull();
  expect(view.find('reboot-heading')?.textContent).toBe('REBOOT');
  view.close();
});

it('preserves transient controls after refused imports and resets them only after successful replacement', async () => {
  const view = await mountM4('phase5-midgame');
  view.click('workspace-CORP-finance'); view.click('kernel-size-toggle'); view.click('processes-open');
  const dialog = view.find('processes-dialog');
  const before = gameStore.store.getState();
  act(() => { expect(importPlayerSave('not a save').ok).toBe(false); });
  expect(gameStore.store.getState()).toEqual(before);
  expect(view.find('processes-dialog')).toBe(dialog);
  expect(view.find('workspace-CORP-finance')?.getAttribute('aria-selected')).toBe('true');
  expect(view.find('kernel-size-toggle')?.getAttribute('aria-expanded')).toBe('true');
  act(() => { expect(importPlayerSave(exportSave(before.game)).ok).toBe(true); });
  expect(view.find('processes-dialog')).toBeNull();
  expect(view.find('workspace-CORP-work')?.getAttribute('aria-selected')).toBe('true');
  expect(view.find('kernel-size-toggle')?.getAttribute('aria-expanded')).toBe('false');
  view.close();
});

it('keeps live time progressing exactly once across imports and resets', async () => {
  const view = await mountM4('tick-0');
  act(() => { expect(importPlayerSave(exportSave(m4State('phase-1-widgets'))).ok).toBe(true); });
  const time = gameStore.store.getState().game.simTimeSec;
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(gameStore.store.getState().game.simTimeSec).toBeCloseTo(time + 1);
  view.click('save-open'); view.click('save-reset'); view.click('save-reset-confirm');
  view.click('manual-cycle');
  expect(gameStore.store.getState().game.cycles).toBe(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(gameStore.store.getState().game.simTimeSec).toBeCloseTo(1);
  expect(gameStore.store.getState().game.cycles).toBe(1);
  view.close();
});
