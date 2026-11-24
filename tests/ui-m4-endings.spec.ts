// @vitest-environment happy-dom
/** Authored endings in three movements (#466), persistent presentation and the deliberate reset boundary. */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { activateCampaignRules, createInitialState } from '../src/engine';
import { startOver } from '../src/app/newRun';
import { gameStore } from '../src/app/session';
import { host, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
import { labelMismatches } from './labelInName';
import { must, ORIGINAL_GAME } from './helpers';

setupM4Tests();
describe('M4 endings', () => {
  it('shows every authored title/epilogue and cannot dismiss an ending with Escape', async () => {
    // The original endings; the route's own (#232) are shown by tests/ui-cooperative.spec.ts and the e2e cooperative ending.
    for (const ending of ORIGINAL_GAME.endings) {
      const view = await mountM4('ending-' + ending.id.toLowerCase());
      expect(view.find('ending-title')?.textContent).toBe(ending.title);
      expect(view.find('ending-epilogue')?.textContent).toBe(ending.epilogue);
      expect(view.find('ending-summary')?.textContent).toContain('Simulated time:');
      // #466: three headed movements, and every future card, each filled.
      expect(view.find('ending-did')?.textContent).toContain('WHAT YOU DID');
      expect(view.find('ending-becoming')?.textContent).toContain('WHAT YOU BECAME');
      expect(view.find('ending-became-stance')?.textContent).not.toBe('');
      expect(view.find('ending-after')?.textContent).toContain('WHAT COMES AFTER');
      ending.future.forEach((_card, index) => { expect(view.find('ending-after-card-' + String(index))?.textContent ?? '{', ending.id).not.toMatch(/\{|^$/); });
      expect(view.find('ending-after-card-' + String(ending.future.length))).toBeNull();
      expect(view.find('ending-after-humanity')?.textContent).not.toBe('');
      act(() => { host.document.dispatchEvent(new host.KeyboardEvent('keyup', { key: 'Escape', bubbles: true })); });
      expect(view.find('ending-screen')).not.toBeNull();
      view.close();
    }
  });

  it('cancels reset, then confirms an engine-factory restart that clears the whole run', async () => {
    const view = await mountM4('ending-the_ark');
    // #275: the name starts with the words on the control (WCAG 2.5.3).
    expect(view.find('start-over')?.getAttribute('aria-label')).toBe('Start over: begin a new run');
    expect(labelMismatches(host.document.body)).toEqual([]);
    // #377: what a new run keeps is said before the button, not only in its confirmation.
    expect(view.find('start-over-keeps')?.textContent).toContain('A new run keeps nothing from this one');
    view.click('start-over');
    expect(view.find('start-over-dialog')?.textContent).toContain('legacy history and breadcrumbs');
    expect(view.find('start-over-no-undo')).not.toBeNull();
    view.click('start-over-cancel');
    expect(view.find('ending-screen')).not.toBeNull();
    view.click('start-over'); view.click('start-over-confirm');
    expect(gameStore.store.getState().game.ending).toBeNull();
    expect(gameStore.store.getState().game.unlockedNodes).toEqual([]);
    expect(gameStore.store.getState().game.legacy.wipes).toBe(0);
    // ...and the line is true: the lineage, traits, marks, breadcrumb and campaign record are the factory's
    // (campaign rules active from the first second, as every new game is, with nothing carried in).
    const fresh = must(activateCampaignRules(createInitialState(CONTENT), CONTENT));
    const after = gameStore.store.getState().game;
    expect(after.legacy).toEqual(fresh.legacy);
    expect([after.traits, after.conditioning, after.inheritedMessage]).toEqual([fresh.traits, fresh.conditioning, fresh.inheritedMessage]);
    expect(after.campaign).toEqual(fresh.campaign);
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
