/**
 * 200% text on every route surface (DZ-13.4), the way large-text.e2e.ts doubles it for production: every
 * text run's CSS font size and line height doubled (a controlled text-only stress, not browser zoom or
 * native font scaling). Each enabled control of the surface must stay reachable by scrolling, uncovered and
 * at least 44px; no text run may spill out of its box or the surface, none may overlap another or a control,
 * and the document must not scroll sideways. FIXTURE states, phone and desktop projects.
 */
import { expect, test, type Page } from '@playwright/test';
import type { Element, HTMLElement, Window } from 'happy-dom';
import { openRouteState } from './routeSave';
import { enabledButtons, ROUTE_STATES } from './routeStates';

async function doubleText(page: Page): Promise<void> {
  await page.evaluate(() => {
    const browser = globalThis as unknown as Window;
    const rows = [...browser.document.querySelectorAll<HTMLElement>('[dir="auto"]')]
      .filter((element) => !element.dataset.originalFont)
      .map((element) => ({ element, font: Number.parseFloat(browser.getComputedStyle(element).fontSize),
        line: Number.parseFloat(browser.getComputedStyle(element).lineHeight) }));
    for (const { element, font, line } of rows) {
      element.dataset.originalFont = String(font);
      element.style.fontSize = String(font * 2) + 'px';
      element.style.lineHeight = String(line * 2) + 'px';
    }
  });
  await page.waitForTimeout(250);
}

/**
 * Text runs that spill out of their own box or out of the surface sideways, and pairs of text runs or
 * controls whose boxes overlap, measured in the page. A run nested in another, or in a control, is not a pair.
 * Overlap compares what is painted: each box is clipped to its scrolling ancestors, so a line scrolled under a
 * dialog's pinned footer (#371) is hidden by its scroll body, not drawn over the footer.
 */
function layoutProblems(scopeId: string): { runs: number; problems: string[] } {
  const browser = globalThis as unknown as Window;
  const scope = browser.document.querySelector('[data-testid="' + scopeId + '"]');
  if (scope === null) return { runs: 0, problems: ['no surface ' + scopeId] };
  const edge = scope.getBoundingClientRect();
  const name = (element: Element) => (element.getAttribute('data-testid') ?? '') + ' "' + element.textContent.trim().slice(0, 40) + '"';
  const leaves = [...scope.querySelectorAll<HTMLElement>('[dir="auto"]')].filter((element) => element.querySelector('[dir="auto"]') === null
    && element.getBoundingClientRect().width > 0 && element.textContent.trim() !== '');
  const problems: string[] = [];
  for (const element of leaves) {
    const box = element.getBoundingClientRect();
    if (element.scrollWidth > element.clientWidth + 1 && browser.getComputedStyle(element).display !== 'inline') problems.push('spills its box: ' + name(element));
    if (box.left < edge.left - 1 || box.right > edge.right + 1) problems.push('outside the surface: ' + name(element));
  }
  const boxes = [...leaves.filter((element) => element.closest('[role="button"]') === null), ...scope.querySelectorAll('[role="button"]')];
  const painted = (element: Element) => {
    let { left, top, right, bottom } = element.getBoundingClientRect();
    for (let parent = element.parentElement; parent !== null && parent !== scope.parentElement; parent = parent.parentElement) {
      const style = browser.getComputedStyle(parent);
      if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
      const clip = parent.getBoundingClientRect();
      left = Math.max(left, clip.left); top = Math.max(top, clip.top); right = Math.min(right, clip.right); bottom = Math.min(bottom, clip.bottom);
    }
    return { left, top, right, bottom };
  };
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (!a || !b || a.contains(b) || b.contains(a)) continue;
      const p = painted(a), q = painted(b);
      const width = Math.min(p.right, q.right) - Math.max(p.left, q.left), height = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
      if (width > 1 && height > 1) problems.push('overlap: ' + name(a) + ' / ' + name(b));
    }
  }
  return { runs: leaves.length, problems };
}

for (const entry of ROUTE_STATES) {
  test('200% text route ' + entry.name, async ({ page }, info) => {
    test.skip(entry.phoneOnly === true && info.project.name !== 'phone', 'only the phone tier renders this surface');
    await openRouteState(page, entry);
    await doubleText(page);
    for (const control of await enabledButtons(page.getByTestId(entry.scope))) {
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport();
      // `trial` checks that nothing else would take the click at the control's centre.
      await control.click({ trial: true, timeout: 5000 });
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByTestId(entry.reach).scrollIntoViewIfNeeded();
    await expect(page.getByTestId(entry.reach)).toBeInViewport();
    const layout = await page.evaluate(layoutProblems, entry.scope);
    expect(layout.runs, 'text runs measured').toBeGreaterThan(0);
    expect(layout.problems).toEqual([]);
    expect(await page.evaluate(() => {
      const browser = globalThis as unknown as Window;
      return browser.document.documentElement.scrollWidth <= browser.innerWidth + 1;
    }), 'no horizontal page scroll').toBe(true);
  });
}
