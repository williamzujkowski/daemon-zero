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
  it('keeps resources and purchases in one flow, with run-ending alerts in the chrome, without nesting the virtualized log', async () => {
    const view = await mountM4('corporate-insolvent'); viewport(390, 844);
    const primary = view.find('terminal-primary-scroll');
    expect(primary).not.toBeNull();
    for (const id of ['resource-strip', 'workspace-CORP', 'pane-scroll-CORP']) {
      const element = view.find(id);
      expect(element, id).not.toBeNull(); expect(contains(primary, element), id).toBe(true);
    }
    // #125: the run-ending alerts moved from the CORP workspace block to the top of
    // the chrome, above the resource strip. On mobile the whole screen is one scroll,
    // so this is not about pinning: it is that the sentence now sits where the player
    // arrives (111px at 320x568 rather than 548px behind the tab bar) and renders in
    // every workspace slot instead of only CORP.
    const alert = view.find('insolvency-warning');
    expect(alert).not.toBeNull();
    const order = primary?.textContent ?? '';
    expect(order.indexOf('INSOLVENT')).toBeGreaterThanOrEqual(0);
    // #139: the phone chrome abbreviates its meter labels, so this reads the short form.
    // The alert still has to precede the first meter in document order.
    expect(order.indexOf('INSOLVENT')).toBeLessThan(order.indexOf('CYC'));
    expect(view.find('pane-scroll-CORP')?.style.flex).not.toBe('1');
    // The phone tier drops the kernel band: its 44px tap target set a 57px floor the
    // purchase could not afford (vote: menu-route-drops-the-band). History opens from the
    // utility menu and stays outside the primary scroll.
    expect(view.find('kernel-dock')).toBeNull();
    view.click('menu-open');
    view.click('menu-kernel');
    expect(view.find('menu-kernel-log')).not.toBeNull();
    expect(contains(primary, view.find('kernel-log'))).toBe(false);
    view.click('menu-close');
    expect(contains(primary, view.find('terminal-tabs'))).toBe(false);
    expect(view.find('terminal-tabs-scroll')).not.toBeNull();
    const state = gameStore.store.getState().game;
    view.click('workspace-CORP-finance');
    expect(contains(primary, view.find('power-ledger'))).toBe(true);
    expect(contains(primary, view.find('insolvency-warning'))).toBe(true);
    view.click('tab-CORE');
    // EXECUTE has retired by phase 4 (#447); the CORE pane's purchases are what share the flow now.
    expect(view.find('manual-cycle')).toBeNull();
    expect(contains(primary, view.find('pane-scroll-CORE'))).toBe(true);
    expect(gameStore.store.getState().game).toBe(state);
  });

  it.each([256, 390])('separates bounded history from the primary flow on a %ipx high mobile screen and preserves game state', async (height) => {
    const view = await mountM4('phase5-midgame'); viewport(844, height);
    const state = gameStore.store.getState().game;
    expect(view.find('kernel-dock')).toBeNull();
    view.click('menu-open');
    view.click('menu-kernel');
    // Bounded history renders inside the menu surface, never inside the primary scroll.
    expect(contains(view.find('terminal-primary-scroll'), view.find('kernel-log'))).toBe(false);
    view.click('menu-close');
    expect(view.find('menu-kernel-log')).toBeNull();
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
