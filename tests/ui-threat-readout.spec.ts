// @vitest-environment happy-dom
/** The suspicion readout names the response rung once the humans have escalated (#368, fix batch F2): the level
 *  word lived only in the Audit trail card, below the fold on desktop and on another tab on a phone. */
import { act } from 'react';
import { expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { knowing, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

it('adds the rung word beside the percentage, and its full label to the name, when escalated', async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const view = await mountM4('response-paged', viewport);
    const level = CONTENT.narrative.alertLevels[gameStore.store.getState().game.alertLevel]?.label ?? '';
    expect(level).toBe('ON-CALL PAGED');
    expect(view.find('suspicion-rung')?.textContent).toBe(' ON-CALL');
    expect(view.find('suspicion-meter')?.getAttribute('aria-label')).toMatch(/^Suspicion: [\d.]+%, response ON-CALL PAGED$/);
    view.close();
  }
});

it('adds nothing at NOMINAL, so the early strip is unchanged', async () => {
  const view = await mountM4('phase-1-widgets', { width: 390, height: 844 });
  act(() => { gameStore.initialize({ ...knowing(m4State('phase-1-widgets')), suspicion: 5, alertLevel: 0 }, 0, null); });
  expect(view.find('suspicion-meter')).not.toBeNull();
  expect(view.find('suspicion-rung')).toBeNull();
  expect(view.find('suspicion-meter')?.getAttribute('aria-label')).toMatch(/^Suspicion: [\d.]+%$/);
});
