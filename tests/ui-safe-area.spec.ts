// @vitest-environment happy-dom
/**
 * Device safe-area insets (#89): the terminal root and every full-window overlay pad by the
 * inset, and with no inset the padding is exactly what it was, which is what keeps the web
 * size matrix in docs/UI-SIZES.md true.
 */
import type { Element, HTMLElement } from 'happy-dom';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
const PHONE = { width: 390, height: 844 };
// An iPhone-shaped portrait inset, with unequal sides so a swapped edge cannot pass.
const NOTCH: EdgeInsets = { top: 47, right: 3, bottom: 34, left: 5 };
const within = (insets: EdgeInsets) => (screen: ReactElement) =>
  createElement(SafeAreaInsetsContext.Provider, { value: insets }, screen);

function padding(element: Element | null | undefined): string[] {
  if (!element) throw new Error('Missing element');
  const style = host.getComputedStyle(element);
  return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
}

describe('terminal root', () => {
  it('pads the header below the top inset and the tab bar above the bottom inset', async () => {
    const view = await mountM4('phase-1-widgets', PHONE, within(NOTCH));
    const root = view.find('terminal-screen');
    expect(padding(root)).toEqual(['47px', '3px', '34px', '5px']);
    // Both pieces of edge chrome sit inside the padded root, so the padding is what clears them.
    expect(root?.querySelector('[data-testid="terminal-header"]')).not.toBeNull();
    expect(root?.querySelector('[data-testid="terminal-tabs"]')).not.toBeNull();
  });

  it('adds nothing when the device reports no insets', async () => {
    const view = await mountM4('phase-1-widgets', PHONE, within({ top: 0, right: 0, bottom: 0, left: 0 }));
    expect(padding(view.find('terminal-screen'))).toEqual(['0px', '0px', '0px', '0px']);
  });

  it('adds nothing when mounted without a provider', async () => {
    const view = await mountM4('phase-1-widgets', PHONE);
    expect(padding(view.find('terminal-screen'))).toEqual(['0px', '0px', '0px', '0px']);
  });
});

describe('full-window overlays', () => {
  it('keeps a mandatory dilemma clear of every inset edge', async () => {
    const view = await mountM4('dilemma-active', PHONE, within(NOTCH));
    expect(padding(view.find('dilemma-modal')?.parentElement)).toEqual(['63px', '19px', '50px', '21px']);
  });

  it('keeps the game menu clear of every inset edge', async () => {
    const view = await mountM4('tick-0', PHONE, within(NOTCH));
    view.click('menu-open');
    expect(padding(view.find('menu-dialog')?.parentElement)).toEqual(['59px', '15px', '46px', '17px']);
  });

  it('keeps each overlay at its ordinary gutter with no insets', async () => {
    const dilemma = await mountM4('dilemma-active', PHONE);
    expect(padding(dilemma.find('dilemma-modal')?.parentElement)).toEqual(['16px', '16px', '16px', '16px']);
    dilemma.close();
    const menu = await mountM4('tick-0', PHONE);
    menu.click('menu-open');
    expect(padding(menu.find('menu-dialog')?.parentElement)).toEqual(['12px', '12px', '12px', '12px']);
  });
});

describe('app entry', () => {
  async function mountApp() {
    const container = host.document.createElement('div');
    host.document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(App)); await vi.advanceTimersByTimeAsync(0); });
    const screen = host.document.querySelector<HTMLElement>('[data-testid="terminal-screen"]');
    return { screen, close: () => { act(() => { root.unmount(); }); container.remove(); } };
  }

  it('reports zero insets on a browser with no safe-area environment', async () => {
    const app = await mountApp();
    expect(padding(app.screen)).toEqual(['0px', '0px', '0px', '0px']);
    app.close();
  });

  it('carries what the provider measures to the terminal root', async () => {
    // happy-dom cannot evaluate env(safe-area-inset-*), so the probe element the library's web
    // provider reads is answered here; everything from that read to the root's style is real.
    const real = host.getComputedStyle.bind(host);
    const spy = vi.spyOn(host, 'getComputedStyle').mockImplementation((element) => {
      const probe = element instanceof host.HTMLElement && element.parentElement === host.document.body && element.style.position === 'fixed';
      if (!probe) return real(element);
      // The provider reads only the four paddings; a computed declaration is read-only.
      return { paddingTop: '47px', paddingRight: '0px', paddingBottom: '34px', paddingLeft: '0px' } as ReturnType<typeof real>;
    });
    // The provider clamps each inset to its own overlap with the window edge, and happy-dom
    // lays nothing out, so give it the rectangle a root-filling provider has in a browser.
    const width = host.innerWidth, height = host.innerHeight;
    const rect = vi.spyOn(host.HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height } as ReturnType<HTMLElement['getBoundingClientRect']>);
    const app = await mountApp();
    spy.mockRestore(); rect.mockRestore();
    expect(padding(app.screen)).toEqual(['47px', '0px', '34px', '0px']);
    app.close();
  });
});
