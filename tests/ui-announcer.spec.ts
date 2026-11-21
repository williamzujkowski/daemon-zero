// @vitest-environment happy-dom
/** The one announcement path (vote-1795210455666-e01ydjc, F1b): phase changes, unlocks and the AEGIS crossing
 *  are spoken once through a polite live region, and a restore replays nothing (#356, #357, #360). */
import { act } from 'react';
import { expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { thresholdCopy, type GameState } from '../src/engine';
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
  const spoken = view.find('announcer')?.textContent ?? '';
  // Pinned on its shape, not on the component's own template: one "Phase N" lead, never doubled.
  expect(spoken).toMatch(new RegExp('^Phase ' + String(next.phaseId) + '\\b'));
  expect(spoken).not.toMatch(/Phase \d+\W+Phase/);
  expect(spoken).toBe(next.title + '.');
});

it('speaks the arrangement\'s own phase title, not the guest\'s (#394 panel)', async () => {
  const view = await mountM4('phase-2-unlocked', { width: 390, height: 844 });
  const before = gameStore.store.getState().game;
  // An arrangement whose phase has its own title and whose crossing opens no boundary dialog.
  const variant = CONTENT.contextCopy.phases.find((entry) => entry.provenance === undefined && entry.phaseId > 0
    && entry.contexts.every((context) => thresholdCopy({ access: { ...before.access, context } }, entry.phaseId - 1, entry.phaseId, CONTENT) === null));
  const context = variant?.contexts[0];
  if (!variant || context === undefined) throw new Error('no arrangement phase title without a boundary dialog');
  const access = { ...before.access, context };
  advanceTo({ ...before, access, currentPhase: variant.phaseId - 1 });
  advanceTo({ ...gameStore.store.getState().game, currentPhase: variant.phaseId });
  const guest = CONTENT.phases.find((phase) => phase.phaseId === variant.phaseId)?.title;
  expect(view.find('announcer')?.textContent).toBe(variant.title + '.');
  expect(variant.title).not.toBe(guest);
});

it('keeps a burst of events as separate lines, so a later sentence does not replace an earlier one', async () => {
  const view = await mountM4('phase-2-unlocked', { width: 390, height: 844 });
  const before = gameStore.store.getState().game;
  const next = CONTENT.phases.find((phase) => phase.phaseId === before.currentPhase + 1);
  const fresh = [...CONTENT.widgets.values()].find((widget) => !before.unlockedWidgets.includes(widget.id));
  if (!next || !fresh) throw new Error('fixture has no next phase or locked widget');
  advanceTo({ ...before, currentPhase: next.phaseId });
  advanceTo({ ...gameStore.store.getState().game, unlockedWidgets: [...gameStore.store.getState().game.unlockedWidgets, fresh.id] });
  const lines = [...(view.find('announcer')?.children ?? [])].map((child) => child.textContent);
  expect(lines).toEqual([next.title + '.', `New on ${fresh.slot}: ${fresh.title}.`]);
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
  // A further rise is no new event; falling back below the mark clears the stale warning.
  advanceTo({ ...gameStore.store.getState().game, aegisLock: 91 });
  expect(view.find('announcer')?.textContent).toContain('AEGIS hunter lock past 90%');
  advanceTo({ ...gameStore.store.getState().game, aegisLock: 70 });
  expect(view.find('announcer')?.textContent).toBe('');
});
