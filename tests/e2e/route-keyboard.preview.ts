/**
 * Keyboard operability of every route surface (DZ-13.4) on the preview export: Tab from the top of the
 * document reaches each enabled control of the surface, each shows the injected focus ring (#111) and is
 * not covered where it stands (WCAG 2.4.7, 2.4.11), focus leaves a non-modal surface and stays inside a
 * modal one, and the surface's operation works from Enter or Space alone. FIXTURE states, live clock;
 * this is a scripted keyboard pass in headless Chromium, not a screen-reader or device test.
 */
import { expect, test, type Page } from '@playwright/test';
import { openRouteState } from './previewSave';
import { enabledButtons, ROUTE_STATES } from './routeStates';

/** Enough presses to pass the chrome and the longest surface twice over. */
const TAB_LIMIT = 160;

interface Stop { id: string; inScope: boolean; inDialog: boolean; ring: boolean; covered: boolean }

/** Where focus is after a press, read in the page: its test ID, whether it is inside the surface, and its ring. */
function readFocus(scopeId: string): Stop {
  const browser = globalThis as unknown as { document: { activeElement: FocusElement | null; elementFromPoint(x: number, y: number): FocusElement | null; querySelector(s: string): FocusElement | null };
    getComputedStyle(element: FocusElement): { outlineStyle: string; outlineWidth: string } };
  interface FocusElement { getAttribute(name: string): string | null; matches(selector: string): boolean; closest(selector: string): FocusElement | null;
    contains(other: FocusElement | null): boolean; getBoundingClientRect(): { left: number; top: number; width: number; height: number } }
  const active = browser.document.activeElement;
  if (active === null) return { id: '', inScope: false, inDialog: false, ring: false, covered: false };
  const scope = browser.document.querySelector('[data-testid="' + scopeId + '"]');
  const style = browser.getComputedStyle(active);
  const box = active.getBoundingClientRect();
  const top = browser.document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  return {
    id: active.getAttribute('data-testid') ?? active.getAttribute('role') ?? '',
    inScope: scope !== null && scope.contains(active),
    inDialog: active.closest('[aria-modal="true"]') !== null,
    ring: active.matches(':focus-visible') && style.outlineStyle === 'solid' && Number.parseFloat(style.outlineWidth) >= 2,
    covered: box.width > 0 && top !== null && !active.contains(top) && !top.contains(active),
  };
}

async function tabThrough(page: Page, scopeId: string, targets: readonly string[], modal: boolean): Promise<{ seen: Set<string>; stops: Stop[]; left: boolean }> {
  const seen = new Set<string>();
  const stops: Stop[] = [];
  let entered = false, left = false;
  await page.evaluate(() => { (globalThis as unknown as { document: { activeElement: { blur?: () => void } | null } }).document.activeElement?.blur?.(); });
  for (let press = 0; press < TAB_LIMIT; press++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(readFocus, scopeId);
    stops.push(stop);
    if (stop.inScope) { entered = true; if (targets.includes(stop.id)) seen.add(stop.id); }
    else if (entered && stop.id !== '') left = true;
    // A modal is walked round once more so a stop outside it would show; a page surface until focus leaves it.
    if (seen.size === targets.length && (modal ? press >= targets.length * 2 + 2 : left)) break;
  }
  return { seen, stops, left };
}

for (const entry of ROUTE_STATES) {
  test('keyboard preview ' + entry.name, async ({ page }, info) => {
    test.skip(entry.phoneOnly === true && info.project.name !== 'preview-phone', 'only the phone tier renders this surface');
    await openRouteState(page, entry);
    const scope = page.getByTestId(entry.scope);
    const targets: string[] = [];
    for (const button of await enabledButtons(scope)) targets.push(await button.getAttribute('data-testid') ?? '');
    const { seen, stops, left } = await tabThrough(page, entry.scope, targets, entry.modal === true);
    expect([...seen].sort(), 'every enabled control is a Tab stop').toEqual([...targets].sort());
    const onTargets = stops.filter((stop) => stop.inScope && targets.includes(stop.id));
    expect(onTargets.filter((stop) => !stop.ring).map((stop) => stop.id), 'focus ring on every control').toEqual([]);
    expect(onTargets.filter((stop) => stop.covered).map((stop) => stop.id), 'no focused control is covered').toEqual([]);
    if (entry.modal === true && targets.length > 0) {
      expect(stops.filter((stop) => stop.id !== '' && !stop.inDialog).map((stop) => stop.id), 'focus stays in the modal').toEqual([]);
    } else if (targets.length > 0) {
      expect(left, 'focus can leave the surface').toBe(true);
    }
    if (entry.operate) {
      const control = page.getByTestId(entry.operate.control);
      await control.focus();
      await expect(control).toBeFocused();
      await page.keyboard.press(entry.operate.key);
      await entry.operate.then(page);
    }
  });
}
