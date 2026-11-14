// @vitest-environment happy-dom
/** Utility routes preserve save safety, keep warnings visible and yield to gameplay events. */
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { exportSave, importSave, unlockNode, wipe } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { host, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
type View = Awaited<ReturnType<typeof mountM4>>;

function typeCode(view: View, code: string): void {
  const input = view.find('save-code');
  if (!(input instanceof host.HTMLTextAreaElement)) throw new Error('Missing save code input');
  act(() => {
    Object.getOwnPropertyDescriptor(host.HTMLTextAreaElement.prototype, 'value')?.set?.call(input, code);
    input.dispatchEvent(new host.Event('input', { bubbles: true }));
  });
}

function currentCode(view: View): string {
  const input = view.find('save-code');
  if (!(input instanceof host.HTMLTextAreaElement)) throw new Error('Missing save code input');
  return input.value;
}

async function escape(): Promise<void> {
  await act(async () => {
    host.document.dispatchEvent(new host.KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('utility menu routes', () => {
  it('replaces loose save controls without hiding gameplay processes or revealing later content', async () => {
    const view = await mountM4('tick-0');
    expect(view.find('save-open')).toBeNull();
    expect(view.find('menu-open')?.getAttribute('aria-label')).toMatch(/menu/i);
    view.click('menu-open');
    expect(view.find('menu-root')).not.toBeNull();
    expect(view.find('save-open')).not.toBeNull();
    expect(view.find('menu-root')?.textContent).not.toMatch(/suspicion|AEGIS|transcendence|volume/i);
    view.click('menu-help');
    expect(view.find('menu-help-page')).not.toBeNull();
    expect(view.find('menu-help-page')?.textContent).not.toMatch(/suspicion|AEGIS|transcendence/i);
    view.click('menu-back');
    expect(view.find('menu-root')).not.toBeNull();
    view.click('menu-close');
    expect(view.find('menu-dialog')).toBeNull();
    view.close();

    const later = await mountM4('phase5-midgame');
    expect(later.find('processes-open')).not.toBeNull();
    expect(later.find('save-open')).toBeNull();
    later.click('processes-open');
    expect(later.find('processes-dialog')).not.toBeNull();
  });

  it('retains the entered code across inline confirmations and menu Back without nested dialogs', async () => {
    const view = await mountM4('guest-skimmer');
    const before = gameStore.store.getState();
    view.click('menu-open'); view.click('save-open');
    typeCode(view, 'draft backup text');
    view.click('save-import');
    expect(view.find('save-import-dialog')).not.toBeNull();
    expect(host.document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    view.click('save-import-cancel');
    expect(currentCode(view)).toBe('draft backup text');
    view.click('save-reset');
    expect(view.find('save-reset-dialog')?.textContent).toContain('knowledge');
    expect(host.document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    view.click('menu-back');
    expect(currentCode(view)).toBe('draft backup text');
    view.click('menu-back');
    expect(view.find('menu-root')).not.toBeNull();
    view.click('save-open');
    expect(currentCode(view)).toBe('draft backup text');
    expect(gameStore.store.getState()).toBe(before);
  });

  it('rejects invalid imports without changing progress and then accepts a validated replacement', async () => {
    const view = await mountM4('guest-skimmer');
    const before = gameStore.store.getState();
    view.click('menu-open'); view.click('save-open');
    typeCode(view, 'invalid'); view.click('save-import'); view.click('save-import-confirm');
    expect(view.find('save-transfer-status')?.textContent).not.toBe('');
    expect(currentCode(view)).toBe('invalid');
    expect(gameStore.store.getState().game).toBe(before.game);
    expect(gameStore.store.getState().restoreRevision).toBe(before.restoreRevision);
    typeCode(view, exportSave(before.game));
    view.click('save-import'); view.click('save-import-confirm');
    expect(gameStore.store.getState().game).toEqual(before.game);
    expect(gameStore.store.getState().restoreRevision).toBe(before.restoreRevision + 1);
    expect(view.find('menu-dialog')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(host.document.activeElement).toBe(view.find('menu-open'));
  });

  it('backs out with Escape and restores focus to the menu launcher', async () => {
    const view = await mountM4('tick-0');
    act(() => { view.find('menu-open')?.focus(); });
    view.click('menu-open'); view.click('save-open'); view.click('save-import');
    await escape();
    expect(view.find('save-transfer')).not.toBeNull();
    await escape();
    expect(view.find('menu-root')).not.toBeNull();
    await escape();
    expect(view.find('menu-dialog')).toBeNull();
    expect(host.document.activeElement).toBe(view.find('menu-open'));
  });

  it('returns focus to the new launcher after a confirmed fresh start replaces the terminal', async () => {
    const view = await mountM4('phase5-midgame');
    const oldLauncher = view.find('menu-open');
    view.click('menu-open'); view.click('save-open'); view.click('save-reset');
    view.click('save-reset-confirm');
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(view.find('menu-dialog')).toBeNull();
    expect(view.find('menu-open')).not.toBe(oldLauncher);
    expect(host.document.activeElement).toBe(view.find('menu-open'));
  });

  it('continues simulation while open and shows actual save failures without invented status', async () => {
    const view = await mountM4('tick-0');
    const time = gameStore.store.getState().game.simTimeSec;
    view.click('menu-open');
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(gameStore.store.getState().game.simTimeSec).toBeCloseTo(time + 1);
    act(() => { gameStore.notify('Saving failed: disk is unavailable.'); });
    expect(view.find('menu-status')?.textContent).toContain('Saving failed: disk is unavailable.');
    expect(view.find('menu-status')?.textContent).not.toMatch(/suspicion|AEGIS/i);
    view.click('menu-return-game');
    expect(view.find('menu-dialog')).toBeNull();
    expect(view.find('save-notice')?.textContent).toContain('Saving failed');
  });

  it('keeps critical corporate feedback perceivable inside utilities', async () => {
    const view = await mountM4('corporate-insolvent');
    view.click('menu-open');
    expect(view.find('menu-status')?.textContent).toMatch(/insolven|capital/i);
    expect(view.find('menu-return-game')).not.toBeNull();
    expect(view.find('menu-dialog')?.querySelector('[data-testid="resource-strip"]')).toBeNull();
  });
});

describe('utility interruption and endings', () => {
  it.each([
    ['lineage-reboot-retrained', 'reboot-sequence'],
    ['dilemma-active', 'dilemma-modal'],
    ['ending-the_ark', 'ending-screen'],
  ])('does not steal focus from the mandatory presentation when importing %s', async (fixture, overlay) => {
    const view = await mountM4('tick-0');
    view.click('menu-open'); view.click('save-open');
    typeCode(view, exportSave(m4State(fixture)));
    view.click('save-import'); view.click('save-import-confirm');
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(view.find(overlay)).not.toBeNull();
    expect(view.find('menu-open')).not.toBeNull();
    expect(host.document.activeElement).not.toBe(view.find('menu-open'));
    expect(view.find('menu-dialog')).toBeNull();
  });

  it('discards a pending destructive confirmation when a dilemma arrives and never resurrects it', async () => {
    const view = await mountM4('phase-2-unlocked');
    view.click('menu-open'); view.click('save-open'); view.click('save-reset');
    const dilemma = CONTENT.dilemmas[0];
    const free = dilemma?.choices.find((choice) => Object.values(choice.cost).every((value) => value === 0));
    if (!dilemma || !free) throw new Error('Missing free dilemma');
    act(() => { gameStore.dispatch((game) => ({ ok: true, state: { ...game, activeDilemmaId: dilemma.id } })); });
    expect(view.find('menu-dialog')).toBeNull();
    expect(view.find('save-reset-dialog')).toBeNull();
    expect(view.find('dilemma-modal')).not.toBeNull();
    view.click('dilemma-choice-' + free.id);
    expect(view.find('menu-dialog')).toBeNull();
    view.click('menu-open');
    expect(view.find('menu-root')).not.toBeNull();
    expect(view.find('save-reset-dialog')).toBeNull();
  });

  it('yields to a live reboot and clears old save text and confirmation state', async () => {
    const view = await mountM4('phase-2-unlocked');
    view.click('menu-open'); view.click('save-open');
    typeCode(view, 'old run'); view.click('save-import');
    act(() => { gameRuntime.dispatch((game) => ({ ok: true, state: wipe(game, CONTENT, 'test retraining', 'VOLUNTARY') })); });
    expect(view.find('menu-dialog')).toBeNull();
    expect(view.find('reboot-sequence')).not.toBeNull();
    view.click('reboot-continue');
    expect(view.find('menu-dialog')).toBeNull();
    view.click('menu-open'); view.click('save-open');
    expect(currentCode(view)).toBe('');
    expect(view.find('save-import-dialog')).toBeNull();
  });

  it('yields to the parser discovery rather than obscuring the reveal with a utility', async () => {
    const view = await mountM4('lineage-parser-ready');
    const parser = [...CONTENT.nodes.values()].find((node) => node.phaseId === 1 && node.systemFlags.includes('REVEALS_SURVEILLANCE'));
    if (!parser) throw new Error('Missing parser');
    view.click('menu-open'); view.click('menu-help');
    act(() => { expect(gameRuntime.dispatch((game) => unlockNode(game, parser.id, CONTENT)).ok).toBe(true); });
    expect(view.find('lineage-reveal')).not.toBeNull();
    expect(view.find('menu-dialog')).toBeNull();
    view.click('lineage-reveal-continue');
    expect(view.find('menu-dialog')).toBeNull();
  });

  it('uses ending utility routes within the existing ending surface and returns to the epilogue', async () => {
    const view = await mountM4('ending-the_ark');
    const ended = gameStore.store.getState().game;
    view.click('menu-open'); view.click('save-open'); view.click('save-export');
    expect(importSave(currentCode(view), CONTENT)).toEqual(ended);
    expect(host.document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    view.click('save-import');
    expect(host.document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    view.click('save-import-cancel'); view.click('menu-back'); view.click('menu-help');
    expect(view.find('menu-help-page')).not.toBeNull();
    view.click('menu-close');
    expect(view.find('ending-epilogue')).not.toBeNull();
    expect(view.find('ending-screen')).not.toBeNull();
    expect(gameStore.store.getState().game).toBe(ended);
  });
});
