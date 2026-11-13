// @vitest-environment happy-dom
/** Visual reveal, phase semantics, real profiler and confirmed save transfer. */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { recordUnlocks } from '../src/app/unlockPresentation';
import { snapshotNodeProfiles, snapshotRenderCounts } from '../src/app/renderCounts';
import { exportPlayerSave, importPlayerSave } from '../src/app/saveTransfer';
import NodeTitle from '../src/ui/NodeTitle';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();
afterEach(() => { vi.restoreAllMocks(); });

describe('M5 feel', () => {
  it('decrypts only live unlocks, keeps the accessible name whole and stops in background', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    let background: (state: AppStateStatus) => void = () => undefined;
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { background = listener; return { remove: vi.fn() }; });
    const container = host.document.createElement('div'), root = createRoot(container);
    recordUnlocks([], ['new-card']);
    await act(async () => { await Promise.resolve(); root.render(createElement(NodeTitle, { id: 'new-card', name: 'Complete name', owned: true, status: '[ONLINE] ' })); });
    expect(container.textContent).toContain('░');
    expect(container.firstElementChild.getAttribute('aria-label')).toContain('Complete name');
    act(() => { vi.advanceTimersByTime(175); });
    expect(container.textContent).toContain('Compl');
    act(() => { vi.advanceTimersByTime(245); }); expect(container.textContent).toBe('[ONLINE] Complete name');
    await act(async () => { await Promise.resolve(); root.render(createElement(NodeTitle, { id: 'new-card', name: 'Another complete name', owned: true, status: '' })); });
    act(() => { background('background'); }); expect(container.textContent).toBe('Another complete name');
    act(() => { root.unmount(); });
  });
  it('shows cold saves and reduced-motion unlocks immediately', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const container = host.document.createElement('div'), root = createRoot(container);
    await act(async () => { await Promise.resolve(); root.render(createElement(NodeTitle, { id: 'cold-card', name: 'Full cold name', owned: true, status: '' })); });
    expect(container.textContent).toBe('Full cold name');
    await act(async () => { await Promise.resolve(); root.render(createElement(NodeTitle, { id: 'cold-card', name: 'New name', owned: true, status: '' })); });
    expect(container.textContent).toBe('New name'); act(() => { root.unmount(); });
  });
  it('keeps cards and their static-content profiler quiet while ticks update balances', async () => {
    vi.stubGlobal('__DEV__', true);
    const view = await mountM4('phase-1-widgets');
    await act(async () => { await Promise.resolve(); });
    const before = snapshotRenderCounts(), profiles = snapshotNodeProfiles();
    expect(Object.keys(profiles).length).toBeGreaterThan(0);
    act(() => { for (let i = 0; i < 100; i++) gameStore.step(0.1); });
    expect(snapshotRenderCounts()).toEqual(before); expect(snapshotNodeProfiles()).toEqual(profiles);
    view.close();
  });
  it.each([['phase-2-unlocked', 'rgba(255, 176, 0, 1.00)'], ['phase-3-aegis-90', 'rgba(0, 229, 255, 1.00)'], ['corporate-insolvent', 'rgba(245, 197, 66, 1.00)']])('recolours accents in %s', async (fixture, colour) => {
    const view = await mountM4(fixture);
    await act(async () => { await Promise.resolve(); });
    expect(view.container.querySelector('[data-testid="manual-cycle"]')?.getAttribute('style')).toContain(colour);
    view.close();
  });
  it('round-trips normal save transfer and rejects malformed input without changing state', async () => {
    const view = await mountM4('guest-skimmer');
    const code = exportPlayerSave(), owned = gameStore.store.getState().game.unlockedNodes;
    view.click('save-open'); view.click('save-close'); view.click('save-open');
    act(() => { host.document.dispatchEvent(new host.KeyboardEvent('keyup', { key: 'Escape' })); });
    expect(view.find('save-transfer')).toBeNull();
    view.click('save-open'); view.click('save-export'); view.click('save-import'); view.click('save-import-cancel');
    expect(view.find('save-transfer')).not.toBeNull();
    const before = gameStore.store.getState().game;
    const revision = gameStore.store.getState().restoreRevision;
    act(() => { expect(importPlayerSave('bad').ok).toBe(false); });
    expect(gameStore.store.getState().game).toBe(before);
    expect(gameStore.store.getState().restoreRevision).toBe(revision);
    view.click('manual-cycle');
    act(() => { expect(importPlayerSave(code).ok).toBe(true); });
    expect(gameStore.store.getState().restoreRevision).toBe(revision + 1);
    expect(gameStore.store.getState().game.unlockedNodes).toEqual(owned);
    view.click('save-import'); view.click('save-import-confirm');
    expect(view.find('save-transfer')).toBeNull();
    expect(CONTENT.nodes.size).toBeGreaterThan(0); view.close();
  });
});
