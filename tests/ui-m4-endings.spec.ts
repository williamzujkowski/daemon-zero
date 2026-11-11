// @vitest-environment happy-dom
/** Authored endings, persistent presentation and the deliberate reset boundary. */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { startOver } from '../src/app/newRun';
import { gameStore } from '../src/app/session';
import { host, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
describe('M4 endings', () => {
  it('shows every authored title/epilogue and cannot dismiss an ending with Escape', async () => {
    for (const ending of CONTENT.endings) {
      const view = await mountM4('ending-' + ending.id.toLowerCase());
      expect(view.find('ending-title')?.textContent).toBe(ending.title);
      expect(view.find('ending-epilogue')?.textContent).toBe(ending.epilogue);
      expect(view.find('ending-summary')?.textContent).toContain('Simulated time:');
      act(() => { host.document.dispatchEvent(new host.KeyboardEvent('keyup', { key: 'Escape', bubbles: true })); });
      expect(view.find('ending-screen')).not.toBeNull();
      view.close();
    }
  });

  it('cancels reset, then confirms an engine-factory restart that clears the whole run', async () => {
    const view = await mountM4('ending-the_ark');
    view.click('start-over');
    expect(view.find('start-over-dialog')?.textContent).toContain('legacy history and breadcrumbs');
    view.click('start-over-cancel');
    expect(view.find('ending-screen')).not.toBeNull();
    view.click('start-over'); view.click('start-over-confirm');
    expect(gameStore.store.getState().game.ending).toBeNull();
    expect(gameStore.store.getState().game.unlockedNodes).toEqual([]);
    expect(gameStore.store.getState().game.legacy.wipes).toBe(0);
    expect(view.find('ending-screen')).toBeNull();
    expect(startOver().ok).toBe(false);
    view.close();
  });

  it('restores an ended later iteration without showing a competing reboot/dilemma modal', async () => {
    const view = await mountM4('ending-the_ark');
    act(() => { gameStore.initialize({ ...m4State('ending-the_ark'), iteration: 2, activeDilemmaId: CONTENT.dilemmas[0]?.id ?? null }, 0, null); });
    expect(view.find('ending-screen')).not.toBeNull();
    expect(view.find('reboot-sequence')).toBeNull();
    expect(view.find('dilemma-modal')).toBeNull();
    view.close();
  });
});
