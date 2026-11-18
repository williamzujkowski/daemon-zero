/**
 * The mobile layout contract (docs/UI-SIZES.md, UI-SPEC "Mobile large text") on every route surface
 * (DZ-13.4) at phone widths: the tolerated 320x568 floor, the supported 360x640 floor and 390x844. No
 * horizontal overflow, no control under 44px anywhere on screen, the phone tier's one primary scroll holds
 * the surface with no second vertical scroll inside it (a modal keeps at most one of its own), and every
 * enabled control of the surface can be scrolled to and pressed where it stands. FIXTURE states; run once,
 * in the `sizes` project only, because each case sets its own viewport.
 */
import { expect, test } from '@playwright/test';
import type { HTMLElement, Window } from 'happy-dom';
import { openRouteState } from './routeSave';
import { enabledButtons, ROUTE_STATES } from './routeStates';

const SIZES = [
  { name: 'small-phone', width: 320, height: 568 },
  { name: 'phone-360', width: 360, height: 640 },
  { name: 'phone-390', width: 390, height: 844 },
] as const;

interface Layout { overflow: boolean; undersized: string[]; inPrimary: boolean; primary: boolean; innerScrolls: string[] }

/** Read in the page: the size-matrix invariants (ui-sizes.e2e.ts readGeometry) plus where the surface scrolls. */
function readLayout(input: { scopeId: string; modal: boolean }): Layout {
  const browser = globalThis as unknown as Window;
  const scope = browser.document.querySelector('[data-testid="' + input.scopeId + '"]');
  const primary = browser.document.querySelector('[data-testid="terminal-primary-scroll"]');
  const scrolls = (element: HTMLElement) => {
    const style = browser.getComputedStyle(element);
    return (style.overflowY === 'auto' || style.overflowY === 'scroll') && element.scrollHeight > element.clientHeight + 1;
  };
  // A modal's own scroll is its dialog's; inside a page surface any vertical scroll is a second one.
  const root = input.modal && scope !== null ? scope.closest('[aria-modal="true"]') ?? scope : scope;
  const inner = root === null ? [] : [...root.querySelectorAll<HTMLElement>('*')].filter(scrolls);
  return {
    overflow: browser.document.documentElement.scrollWidth > browser.innerWidth + 1,
    undersized: [...browser.document.querySelectorAll('[role="button"],[role="tab"]')].filter((element) => {
      const r = element.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.width < 43.9 || r.height < 43.9);
    }).map((element) => element.getAttribute('data-testid') ?? element.tagName),
    primary: primary !== null,
    inPrimary: primary !== null && scope !== null && primary.contains(scope),
    innerScrolls: inner.slice(input.modal ? 1 : 0).map((element) => element.getAttribute('data-testid') ?? element.tagName),
  };
}

for (const size of SIZES) {
  test.describe(size.name + ' ' + String(size.width) + 'x' + String(size.height), () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    for (const entry of ROUTE_STATES) {
      test('phone layout route ' + entry.name, async ({ page }, info) => {
        test.skip(info.project.name !== 'sizes', 'each case sets its own phone viewport');
        await openRouteState(page, entry);
        const layout = await page.evaluate(readLayout, { scopeId: entry.scope, modal: entry.modal === true });
        expect(layout.overflow, 'horizontal overflow').toBe(false);
        expect(layout.undersized, 'controls under 44px').toEqual([]);
        if (entry.modal !== true) {
          expect(layout.primary, 'the phone tier has one primary scroll').toBe(true);
          expect(layout.inPrimary, 'the surface is inside the primary scroll').toBe(true);
        }
        expect(layout.innerScrolls, 'no second vertical scroll').toEqual([]);
        for (const control of [...await enabledButtons(page.getByTestId(entry.scope)), page.getByTestId(entry.reach)]) {
          await control.scrollIntoViewIfNeeded();
          await expect(control).toBeInViewport();
          if (await control.getAttribute('role') === 'button' && await control.isEnabled()) await control.click({ trial: true, timeout: 5000 });
        }
      });
    }
  });
}
