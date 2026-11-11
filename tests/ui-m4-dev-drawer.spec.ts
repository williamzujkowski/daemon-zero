// @vitest-environment happy-dom
/** Exercises the actual lazy drawer and confirms its save-replacement boundaries. */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { createInitialState, exportSave } from '../src/engine';
import { gameStore } from '../src/app/session';
import DevelopmentTools from '../src/app/DevelopmentTools';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
function typeInto(id: string, value: string) {
  const input = host.document.querySelector('[data-testid="' + id + '"]');
  if (!input) throw new Error('Missing input');
  const prototype = input instanceof host.HTMLTextAreaElement ? host.HTMLTextAreaElement.prototype : host.HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new host.Event('input', { bubbles: true }));
  });
}

describe('M4 development drawer', () => {
  it('grants through validated development actions, forces/resolves a dilemma and confirms phase replacement', async () => {
    vi.stubGlobal('__DEV__', true);
    const view = await mountM4('phase-2-unlocked');
    await act(async () => { await vi.dynamicImportSettled(); });
    view.click('dev-open');
    const before = gameStore.store.getState().game.cycles;
    typeInto('dev-amount', '0'); view.click('dev-grant');
    expect(view.find('dev-status')?.textContent).toContain('positive amount');
    typeInto('dev-amount', '100'); view.click('dev-grant');
    expect(gameStore.store.getState().game.cycles).toBe(before + 100);
    const dilemma = CONTENT.dilemmas[0];
    const free = dilemma?.choices.find((choice) => Object.values(choice.cost).every((value) => value === 0));
    if (!dilemma || !free) throw new Error('Missing dilemma');
    view.click('dev-dilemma-' + dilemma.id);
    expect(view.find('dev-drawer')).toBeNull();
    expect(view.find('dilemma-modal')).not.toBeNull();
    view.click('dilemma-choice-' + free.id);
    view.click('dev-open'); view.click('dev-phase-4');
    expect(view.find('dev-jump-dialog')?.textContent).toContain('Erase current');
    view.click('dev-jump-cancel');
    expect(gameStore.store.getState().game.currentPhase).toBe(2);
    view.click('dev-phase-4'); view.click('dev-jump-confirm');
    expect(gameStore.store.getState().game.currentPhase).toBe(4);
    expect(view.find('dev-drawer')).toBeNull();
    view.close();
  });

  it('exports, rejects an invalid import and then confirms a valid replacement', async () => {
    vi.stubGlobal('__DEV__', true);
    const view = await mountM4('ending-the_ark');
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(host.document.querySelectorAll('[data-testid="dev-open"]')).toHaveLength(1);
    view.click('dev-open'); view.click('dev-export');
    const field = host.document.querySelector('[data-testid="dev-save-code"]');
    expect(field instanceof host.HTMLTextAreaElement && field.value.length > 100).toBe(true);
    typeInto('dev-save-code', 'bad'); view.click('dev-import'); view.click('dev-import-confirm');
    expect(view.find('dev-status')).not.toBeNull();
    expect(gameStore.store.getState().game.ending).not.toBeNull();
    typeInto('dev-save-code', exportSave(createInitialState(CONTENT)));
    view.click('dev-import'); view.click('dev-import-confirm');
    expect(gameStore.store.getState().game.ending).toBeNull();
    expect(view.find('dev-drawer')).toBeNull();
    view.close();
  });

  it('requires force-wipe confirmation and reveals the durable reboot', async () => {
    vi.stubGlobal('__DEV__', true);
    const view = await mountM4('deaddrop-breadcrumb');
    await act(async () => { await vi.dynamicImportSettled(); });
    view.click('dev-open'); view.click('dev-force-wipe'); view.click('dev-wipe-cancel');
    expect(gameStore.store.getState().game.iteration).toBe(1);
    view.click('dev-force-wipe'); view.click('dev-wipe-confirm');
    expect(view.find('reboot-breadcrumb')).not.toBeNull();
    view.click('reboot-continue'); view.click('dev-open'); view.click('dev-close');
    expect(view.find('dev-drawer')).toBeNull();
    view.close();
  });

  it('does not render a launcher outside development or leak a late import after unmount', async () => {
    vi.stubGlobal('__DEV__', false);
    const view = await mountM4('tick-0');
    expect(view.find('dev-open')).toBeNull(); view.close();
    vi.stubGlobal('__DEV__', true);
    const root = createRoot(host.document.createElement('div'));
    act(() => { root.render(createElement(DevelopmentTools)); });
    act(() => { root.unmount(); });
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(host.document.querySelector('[data-testid="dev-open"]')).toBeNull();
  });
});
