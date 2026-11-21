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
import { overlaps, type MeasuredBox } from './textOverlap';
import { enabledButtons, ROUTE_STATES } from './routeStates';
import { ENTRY } from './variantEntry';

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
 * Text runs that spill out of their own box or out of the surface sideways, measured in the page, and the boxes of
 * text runs and controls with their scrolling ancestors, for the overlap test (textOverlap.ts). A run nested in
 * another, or in a control, is not a pair. Runs in the page, so it carries its own helpers and imports nothing.
 */
function layoutProblems(scopeId: string): { runs: number; problems: string[]; boxes: MeasuredBox[]; nested: string[] } {
  const browser = globalThis as unknown as Window;
  const scope = browser.document.querySelector('[data-testid="' + scopeId + '"]');
  if (scope === null) return { runs: 0, problems: ['no surface ' + scopeId], boxes: [], nested: [] };
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
  const elements = [...leaves.filter((element) => element.closest('[role="button"]') === null), ...scope.querySelectorAll('[role="button"]')];
  const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  const scrollers = new Map<Element, number>();
  const clipsOf = (element: Element) => {
    const clips: { id: number; rect: ReturnType<typeof rect> }[] = [];
    for (let parent = element.parentElement; parent !== null && parent !== scope.parentElement; parent = parent.parentElement) {
      const style = browser.getComputedStyle(parent);
      if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
      if (!scrollers.has(parent)) scrollers.set(parent, scrollers.size);
      clips.push({ id: scrollers.get(parent) ?? -1, rect: rect(parent) });
    }
    return clips;
  };
  const boxes = elements.map((element) => ({ name: name(element), rect: rect(element), clips: clipsOf(element) }));
  const nested: string[] = [];
  elements.forEach((a, i) => { elements.forEach((b, j) => { if (i < j && (a.contains(b) || b.contains(a))) nested.push(`${String(i)}|${String(j)}`); }); });
  return { runs: leaves.length, problems, boxes, nested };
}

/**
 * PROTOTYPE #385: a CORE variant lifts these parts out of the job surface, so an 'assignment'-scoped entry would no
 * longer reach them; under a variant they are checked as scopes of their own, with every settled fold expanded.
 */
const HOISTED = ['review', 'pilot-service', 'service-grant', 'release-terms', 'departure-terms'];

async function scopesFor(page: Page, scope: string): Promise<string[]> {
  if (ENTRY === './') return [scope];
  // A dialog or the ending covers the pane: its folds are not what this entry is about, and cannot be pressed.
  if (await page.locator('[role="dialog"], [aria-modal="true"], [data-testid="ending-screen"]').count() > 0) return [scope];
  // Expanding a fold drops it from this selector, so always press the first one left (bounded, in case one never opens).
  const folded = page.locator('[data-testid$="-fold-toggle"][aria-expanded="false"]');
  for (let pressed = 0; pressed < 10 && await folded.count() > 0; pressed += 1) await folded.first().click();
  const present: string[] = [];
  for (const id of HOISTED) if (id !== scope && await page.getByTestId(id).count() > 0) present.push(id);
  return [scope, ...present];
}

for (const entry of ROUTE_STATES) {
  test('200% text route ' + entry.name, async ({ page }, info) => {
    test.skip(entry.phoneOnly === true && info.project.name !== 'phone', 'only the phone tier renders this surface');
    await openRouteState(page, entry);
    await doubleText(page);
    for (const scope of await scopesFor(page, entry.scope)) await checkScope(page, scope);
    await page.getByTestId(entry.reach).scrollIntoViewIfNeeded();
    await expect(page.getByTestId(entry.reach)).toBeInViewport();
    expect(await page.evaluate(() => {
      const browser = globalThis as unknown as Window;
      return browser.document.documentElement.scrollWidth <= browser.innerWidth + 1;
    }), 'no horizontal page scroll').toBe(true);
  });
}

/** Every enabled control in a scope is reachable at 44 px, and its text neither clips nor overlaps. */
async function checkScope(page: Page, scope: string): Promise<void> {
  for (const control of await enabledButtons(page.getByTestId(scope))) {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport();
    // `trial` checks that nothing else would take the click at the control's centre.
    await control.click({ trial: true, timeout: 5000 });
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  const layout = await page.evaluate(layoutProblems, scope);
  expect(layout.runs, 'text runs measured in ' + scope).toBeGreaterThan(0);
  const nested = new Set(layout.nested);
  expect([...layout.problems, ...overlaps(layout.boxes, (i, j) => nested.has(`${String(i)}|${String(j)}`))], scope).toEqual([]);
}
