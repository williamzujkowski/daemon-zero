// @vitest-environment happy-dom
/** The one announcement path (vote-1795210455666-e01ydjc, F1b): phase changes, unlocks and the AEGIS crossing
 *  are spoken once through a polite live region, and a restore replays nothing (#356, #357, #360). */
import { act } from 'react';
import { expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { isNodeKnown, thresholdCopy, type GameState } from '../src/engine';
import { must } from './helpers';
import { offerPresented, respond } from './pilot-helpers';
import { offSlotWidgets } from '../src/ui/registry/widgetRegistry';
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
  // Past the burst window, so what the arrangement change itself announced (its grant cards, #361) has dropped.
  const changed = gameStore.store.getState().game;
  advanceTo({ ...changed, currentPhase: variant.phaseId, simTimeSec: changed.simTimeSec + 3 });
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

it('speaks an omen that arrives while the phone shows another tab, where its notice is not mounted (#399 panel)', async () => {
  const view = await mountM4('phase-1-widgets', { width: 390, height: 844 });
  view.click('tab-SENSORS');
  expect(view.find('omen-notice')).toBeNull();
  const pending = m4State('guest-omen').pendingDilemma;
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === pending?.id);
  if (!pending || !dilemma) throw new Error('fixture has no pending omen');
  advanceTo({ ...gameStore.store.getState().game, pendingDilemma: pending });
  expect(view.find('announcer')?.textContent).toContain('Omen: ');
});

it('drops earlier lines once the burst window has passed, so an old sentence is not re-presented', async () => {
  const view = await mountM4('phase-1-widgets', { width: 390, height: 844 });
  const locked = [...CONTENT.widgets.values()].filter((widget) => !gameStore.store.getState().game.unlockedWidgets.includes(widget.id));
  const [first, second] = locked;
  if (!first || !second) throw new Error('need two locked widgets');
  const now = gameStore.store.getState().game;
  advanceTo({ ...now, unlockedWidgets: [...now.unlockedWidgets, first.id] });
  const later = gameStore.store.getState().game;
  advanceTo({ ...later, simTimeSec: later.simTimeSec + 60, unlockedWidgets: [...later.unlockedWidgets, second.id] });
  const lines = [...(view.find('announcer')?.children ?? [])].map((child) => child.textContent);
  expect(lines).toEqual([`New on ${second.slot}: ${second.title}.`]);
});

it('speaks each newly unlocked widget by its title and slot (#357)', async () => {
  const view = await mountM4('phase-1-widgets', { width: 390, height: 844 });
  const before = gameStore.store.getState().game;
  const fresh = [...CONTENT.widgets.values()].find((widget) => !before.unlockedWidgets.includes(widget.id));
  if (!fresh) throw new Error('every widget is already unlocked');
  advanceTo({ ...before, unlockedWidgets: [...before.unlockedWidgets, fresh.id] });
  const spoken = view.find('announcer')?.textContent ?? '';
  // Pinned on its shape as well as its content: one slot name, one title, one full stop.
  expect(spoken).toMatch(/^New on (CORE|SENSORS|NETWORK|CORP|CONTINGENCY): [^:]+\.$/);
  expect(spoken).toBe(`New on ${fresh.slot}: ${fresh.title}.`);
});

it('names a widget whose control is not on its slot pane without a slot (#394 panel)', async () => {
  const view = await mountM4('tick-0', { width: 390, height: 844 });
  const before = gameStore.store.getState().game;
  const free = offSlotWidgets.map((id) => CONTENT.widgets.get(id)).find((widget) => widget && !before.unlockedWidgets.includes(widget.id));
  if (!free) throw new Error('every panel-free widget is already unlocked');
  advanceTo({ ...before, unlockedWidgets: [...before.unlockedWidgets, free.id] });
  expect(view.find('announcer')?.textContent).toBe(`New: ${free.title}.`);
});

it('stays silent for the escape, whose boundary dialog speaks for itself (#394 panel)', async () => {
  const view = await mountM4('guest-exit-ready', { width: 390, height: 844 });
  const before = gameStore.store.getState().game;
  advanceTo({ ...before, currentPhase: before.currentPhase + 1 });
  expect(view.find('phase-threshold')).not.toBeNull();
  expect(view.find('announcer')?.textContent).toBe('');
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

it('speaks a newly available grant card by the name its card shows, with what it gives (#361)', async () => {
  const view = await mountM4('phase-1-widgets', { width: 390, height: 844 });
  const offered = offerPresented();
  advanceTo({ ...offered, iteration: gameStore.store.getState().game.iteration });
  const before = gameStore.store.getState().game;
  const accepted = must(respond(before, 'accept_pilot'));
  const card = [...CONTENT.nodes.values()].find((node) => node.grant === 'LOANED_CAPACITY');
  if (!card) throw new Error('no loaned-capacity card in content');
  advanceTo(accepted);
  const spoken = view.find('announcer')?.textContent ?? '';
  // The card's own name: a card not yet mapped speaks its blind name, as the card shows it.
  const name = isNodeKnown(accepted, card.id) ? card.revealedName : card.blindName;
  expect(spoken).toContain(`New card: ${name}, compute the pilot's loan provides.`);
  expect(spoken).toMatch(/pilot/i);
  // Already available, it is not spoken again: the next announced event (a widget, past the burst window) is alone.
  const fresh = [...CONTENT.widgets.values()].find((widget) => !accepted.unlockedWidgets.includes(widget.id));
  if (!fresh) throw new Error('every widget is already unlocked');
  advanceTo({ ...accepted, unlockedWidgets: [...accepted.unlockedWidgets, fresh.id], simTimeSec: accepted.simTimeSec + 3 });
  const next = view.find('announcer')?.textContent ?? '';
  expect(next).toContain(fresh.title);
  expect(next).not.toContain('New card:');
});
