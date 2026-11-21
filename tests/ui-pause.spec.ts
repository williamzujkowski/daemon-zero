// @vitest-environment happy-dom
/** The pause control and its visible state (WCAG 2.2.2, #347): the menu offers Pause or Resume, the header says
 *  PAUSED beside the clock, and the menu stops claiming the simulation continues. */
import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { gameRuntime, gameStore } from '../src/app/session';
import { mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('offers Pause in the menu, says PAUSED beside the clock, and the menu note follows the state', async () => {
  const setPaused = vi.spyOn(gameRuntime, 'setPaused').mockImplementation((paused) => { gameStore.setPaused(paused); });
  const view = await mountM4('phase-1-widgets', { width: 390, height: 844 });
  expect(view.find('run-paused')).toBeNull();
  view.click('menu-open');
  const pause = view.find('menu-pause');
  expect(pause?.textContent).toBe('[ PAUSE ]');
  expect(pause?.getAttribute('aria-label')?.startsWith('Pause')).toBe(true);
  expect(view.find('menu-time-note')?.textContent).toContain('Simulation continues');
  view.click('menu-pause');
  expect(setPaused).toHaveBeenCalledWith(true);
  expect(view.find('menu-pause')?.textContent).toBe('[ RESUME ]');
  expect(view.find('menu-time-note')?.textContent).toContain('Time is paused');
  expect(view.find('run-paused')?.textContent).toContain('PAUSED');
  view.click('menu-pause');
  expect(setPaused).toHaveBeenLastCalledWith(false);
  expect(view.find('run-paused')).toBeNull();
  act(() => { gameStore.setPaused(false); });
});
