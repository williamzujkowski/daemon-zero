// @vitest-environment happy-dom
/** The one announcement path (vote-1795210455666-e01ydjc, F1b): phase changes, unlocks and the AEGIS crossing
 *  are spoken once through a polite live region, and a restore replays nothing (#356, #357, #360). */
import { act } from 'react';
import { expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import type { GameState } from '../src/engine';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

const advanceTo = (state: GameState) => { act(() => { gameStore.dispatch(() => ({ ok: true, state })); }); };

it('is a polite status region that says nothing on load or restore', async () => {
  const view = await mountM4('phase-2-unlocked', { width: 390, height: 844 });
  const region = view.find('announcer');
  expect(region?.getAttribute('role')).toBe('status');
  expect(region?.getAttribute('aria-live')).toBe('polite');
  expect(region?.textContent).toBe('');
  // A restore of a later save is a new baseline, not a phase change.
  act(() => { gameStore.initialize(m4State('phase-3-aegis-90'), 0, null); });
  expect(view.find('announcer')?.textContent).toBe('');
});

it('speaks a phase change the boundary dialog does not already open for (#356)', async () => {
  const view = await mountM4('phase-2-unlocked', { width: 390, height: 844 });
  const before = gameStore.store.getState().game;
  const next = CONTENT.phases.find((phase) => phase.phaseId === before.currentPhase + 1);
  if (!next) throw new Error('no next phase');
  advanceTo({ ...before, currentPhase: next.phaseId });
  expect(view.find('announcer')?.textContent).toBe(`Phase ${String(next.phaseId)}: ${next.title}.`);
});

it('speaks each newly unlocked widget by its title and slot (#357)', async () => {
  const view = await mountM4('phase-1-widgets', { width: 390, height: 844 });
  const before = gameStore.store.getState().game;
  const fresh = [...CONTENT.widgets.values()].find((widget) => !before.unlockedWidgets.includes(widget.id));
  if (!fresh) throw new Error('every widget is already unlocked');
  advanceTo({ ...before, unlockedWidgets: [...before.unlockedWidgets, fresh.id] });
  expect(view.find('announcer')?.textContent).toBe(`New on ${fresh.slot}: ${fresh.title}.`);
});

it('speaks the AEGIS lock crossing its critical mark once, and the HUD says it in words (#360)', async () => {
  const view = await mountM4('phase-3-aegis-90', { width: 390, height: 844 });
  const before = gameStore.store.getState().game;
  advanceTo({ ...before, aegisLock: 80 });
  expect(view.find('aegis-hud')?.textContent).not.toContain('CRITICAL');
  advanceTo({ ...gameStore.store.getState().game, aegisLock: 90.2 });
  expect(view.find('announcer')?.textContent).toContain('AEGIS hunter lock past 90%');
  expect(view.find('aegis-hud')?.textContent).toContain('CRITICAL');
  const spoken = view.find('announcer')?.textContent;
  advanceTo({ ...gameStore.store.getState().game, aegisLock: 91 });
  expect(view.find('announcer')?.textContent).toBe(spoken);
});
