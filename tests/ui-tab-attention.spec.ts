// @vitest-environment happy-dom
/** Phone tab markers for what waits off-pane (#358): a new widget until its tab is opened, an overheat on SENSORS
 *  and a pending omen on CORE while each holds (the omen now sits under EXECUTE in CORE, #362). */
import { act } from 'react';
import { expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import type { GameState } from '../src/engine';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

const PHONE = { width: 390, height: 844 };
const advanceTo = (state: GameState) => { act(() => { gameStore.dispatch(() => ({ ok: true, state })); }); };
const label = (view: Awaited<ReturnType<typeof mountM4>>, slot: string) => view.find('tab-' + slot)?.getAttribute('aria-label') ?? '';

it('marks the slot of a widget unlocked off-pane until that tab is opened', async () => {
  const view = await mountM4('thermal-unlocked', PHONE);
  const before = gameStore.store.getState().game;
  const fresh = [...CONTENT.widgets.values()].find((widget) => widget.slot === 'SENSORS' && !before.unlockedWidgets.includes(widget.id));
  if (!fresh) throw new Error('no locked SENSORS widget in the fixture');
  expect(label(view, 'SENSORS')).toBe('SENSORS pane');
  advanceTo({ ...before, unlockedWidgets: [...before.unlockedWidgets, fresh.id] });
  expect(label(view, 'SENSORS')).toBe('SENSORS pane, new: ' + fresh.title);
  expect(view.find('tab-SENSORS')?.textContent).toContain('•');
  view.click('tab-SENSORS');
  view.click('tab-CORE');
  expect(label(view, 'SENSORS')).toBe('SENSORS pane');
});

it('marks SENSORS while overheating and CORE while an omen is pending, only when they are not shown', async () => {
  const view = await mountM4('phase-1-widgets', PHONE);
  const hot = { ...gameStore.store.getState().game, thermal: CONTENT.balance.thermalThresholdForSuspicion + 10 };
  advanceTo(hot);
  expect(label(view, 'SENSORS')).toContain('overheating');
  const omen = m4State('guest-omen').pendingDilemma;
  advanceTo({ ...gameStore.store.getState().game, pendingDilemma: omen });
  view.click('tab-SENSORS');
  expect(label(view, 'CORE')).toContain('an omen is pending');
  expect(label(view, 'SENSORS')).toBe('SENSORS pane');
});
