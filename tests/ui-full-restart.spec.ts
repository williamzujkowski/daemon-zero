// @vitest-environment happy-dom
/** Full restart is deliberate, clears the whole engine state, and leaves exported backups usable. */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { createInitialState, deserialize, importSave } from '../src/engine';
import { startFresh, startOver } from '../src/app/newRun';
import { importPlayerSave } from '../src/app/saveTransfer';
import { gameStore } from '../src/app/session';
import { SAVE_KEY } from '../src/app/storage';
import FreshStart from '../src/ui/FreshStart';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('refuses a full restart when the game runtime is inactive', () => {
  const before = gameStore.store.getState();
  expect(startFresh()).toMatchObject({ ok: false, reason: 'The game is not active.' });
  const container = host.document.createElement('div'); host.document.body.appendChild(container);
  const root = createRoot(container), onReset = vi.fn();
  const click = (id: string) => {
    const button = host.document.querySelector('[data-testid="' + id + '"]');
    if (!(button instanceof host.HTMLElement)) throw new Error('Missing ' + id);
    act(() => { button.click(); });
  };
  try {
    act(() => { root.render(createElement(FreshStart, { onReset })); });
    click('save-reset'); click('save-reset-confirm');
    expect(container.textContent).toContain('The game is not active.');
    expect(onReset).not.toHaveBeenCalled();
    expect(gameStore.store.getState()).toBe(before);
  } finally { act(() => { root.unmount(); }); container.remove(); }
});

it.each(['lineage-reboot-retrained', 'phase5-midgame'])('exports, cancels, then completely restarts %s and persists the fresh state', async (fixture) => {
  const view = await mountM4(fixture);
  if (view.find('reboot-continue')) view.click('reboot-continue');
  const before = gameStore.store.getState().game;
  const revision = gameStore.store.getState().restoreRevision;
  expect(startOver().ok).toBe(false);
  view.click('save-open'); view.click('save-export');
  const input = view.find('save-code');
  if (!(input instanceof host.HTMLTextAreaElement)) throw new Error('Missing backup code');
  const code = input.value;
  expect(importSave(code, CONTENT)).toEqual(before);
  view.click('save-reset');
  expect(view.find('save-reset-dialog')?.textContent).toContain('knowledge');
  view.click('save-reset-cancel');
  expect(gameStore.store.getState().game).toBe(before);
  expect(gameStore.store.getState().restoreRevision).toBe(revision);
  view.click('save-reset'); view.click('save-reset-confirm');
  const fresh = createInitialState(CONTENT);
  expect(gameStore.store.getState().game).toEqual(fresh);
  expect(gameStore.store.getState().restoreRevision).toBe(revision + 1);
  expect(view.find('save-transfer')).toBeNull();
  expect(view.find('reboot-sequence')).toBeNull();
  expect(view.find('res-cycles')).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const envelope = JSON.parse(host.localStorage.getItem(SAVE_KEY) ?? '{}') as { game: string };
  expect(deserialize(envelope.game, CONTENT)).toEqual(fresh);
  act(() => { expect(importPlayerSave(code).ok).toBe(true); });
  expect(gameStore.store.getState().game).toEqual(before);
  view.close();
});
