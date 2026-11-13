// @vitest-environment happy-dom
/** Mobile critical content shares a scroll flow; the virtual log retains its own bounded viewport. */
import { act } from 'react';
import type { HTMLElement } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

function viewport(width: number, height: number): void {
  act(() => {
    Object.defineProperty(host.document.documentElement, 'clientWidth', { configurable: true, value: width });
    Object.defineProperty(host.document.documentElement, 'clientHeight', { configurable: true, value: height });
    host.dispatchEvent(new host.Event('resize'));
  });
}

function contains(parent: HTMLElement | null, child: HTMLElement | null): boolean {
  if (!parent || !child) throw new Error('Missing layout region');
  return parent.contains(child);
}

describe('mobile scroll flow', () => {
  it('keeps resources, workspace warnings and purchases in one flow without nesting the virtualized log', async () => {
    const view = await mountM4('corporate-insolvent'); viewport(390, 844);
    const primary = view.find('terminal-primary-scroll');
    expect(primary).not.toBeNull();
    for (const id of ['resource-strip', 'workspace-CORP', 'insolvency-warning', 'pane-scroll-CORP']) {
      const element = view.find(id);
      expect(element, id).not.toBeNull(); expect(contains(primary, element), id).toBe(true);
    }
    expect(view.find('pane-scroll-CORP')?.style.flex).not.toBe('1');
    expect(contains(primary, view.find('kernel-log'))).toBe(false);
    expect(contains(primary, view.find('terminal-tabs'))).toBe(false);
    expect(view.find('terminal-tabs-scroll')).not.toBeNull();
    const state = gameStore.store.getState().game;
    view.click('workspace-CORP-finance');
    expect(contains(primary, view.find('power-ledger'))).toBe(true);
    expect(contains(primary, view.find('insolvency-warning'))).toBe(true);
    view.click('tab-CORE');
    expect(contains(primary, view.find('manual-cycle'))).toBe(true);
    expect(gameStore.store.getState().game).toBe(state);
  });

  it.each([256, 390])('bounds both log sizes on a %ipx high mobile screen and preserves game state', async (height) => {
    const view = await mountM4('phase5-midgame'); viewport(844, height);
    const state = gameStore.store.getState().game;
    const compact = Number.parseFloat(view.find('kernel-dock')?.style.height ?? '0');
    expect(compact).toBeGreaterThanOrEqual(44); expect(compact).toBeLessThan(height / 2);
    view.click('kernel-size-toggle');
    const expanded = Number.parseFloat(view.find('kernel-dock')?.style.height ?? '0');
    expect(expanded).toBeGreaterThan(compact); expect(expanded).toBeLessThan(height / 2);
    expect(view.find('kernel-size-toggle')?.getAttribute('aria-expanded')).toBe('true');
    view.click('kernel-size-toggle');
    expect(Number.parseFloat(view.find('kernel-dock')?.style.height ?? '0')).toBe(compact);
    expect(gameStore.store.getState().game).toBe(state);
  });

  it('keeps guest instructions in the primary flow without revealing later panes and preserves desktop columns', async () => {
    const view = await mountM4('guest-skimmer'); viewport(390, 844);
    expect(contains(view.find('terminal-primary-scroll'), view.find('guest-console'))).toBe(true);
    expect(contains(view.find('terminal-primary-scroll'), view.find('manual-cycle'))).toBe(true);
    expect(view.find('tab-NETWORK')).toBeNull();
    expect(view.find('suspicion-meter')).toBeNull();
    const state = gameStore.store.getState().game;
    viewport(1440, 900);
    expect(view.find('terminal-primary-scroll')).toBeNull();
    expect(view.find('terminal-columns')).not.toBeNull();
    expect(view.find('guest-console')).not.toBeNull();
    expect(gameStore.store.getState().game).toBe(state);
  });
});
