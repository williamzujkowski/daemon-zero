/**
 * Every folded choice row is in the first view (maintainer request, 2026-11-21; the concern behind #371): the title,
 * cost and affordability of each alternative can be read before any is opened. The atlas contract checks only the
 * first row (#427 panel), so this measures all of them, folded as first shown, on the boot fixtures and every route
 * decision. One exception is named, not skipped: the pilot offer shows every term before any answer (DZ-04.3), so
 * its rows follow terms longer than a screen; its order is held by tests/ui-pilot.spec.ts.
 */
import type { Page } from '@playwright/test';
import { boot, expect, test } from './helpers';
import { ROUTE_STATES } from './routeStates';
import { seedRouteSave } from './routeSave';

/** The terms come first by rule, so these rows are reached by scrolling. */
const TERMS_FIRST: readonly string[] = ['pilot offer modal'];

async function expectRowsInView(page: Page): Promise<void> {
  await expect(page.getByTestId('dilemma-modal')).toBeVisible();
  const rows = await page.locator('[data-testid^="dilemma-card-"][data-testid$="-toggle"]').all();
  expect(rows.length).toBeGreaterThan(1);
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('no viewport');
  for (const row of rows) {
    const name = await row.getAttribute('data-testid') ?? 'row';
    const box = await row.boundingBox();
    if (box === null) throw new Error(name + ' has no box');
    expect(box.y, name + ' starts in view').toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, name + ' ends in view').toBeLessThanOrEqual(viewport.height);
  }
}

for (const fixture of ['guest-dilemma', 'dilemma-active', 'cryo-decision-ready'] as const) {
  test('every choice row of ' + fixture + ' is in the first view', async ({ page }) => {
    await boot(page, fixture);
    await expectRowsInView(page);
  });
}

for (const entry of ROUTE_STATES.filter((route) => route.scope === 'dilemma-modal' && !TERMS_FIRST.includes(route.name))) {
  test('every choice row of the ' + entry.name + ' is in the first view', async ({ page }) => {
    await seedRouteSave(page, entry);
    await page.goto('./');
    await expectRowsInView(page);
  });
}

test('the named exception still exists: the pilot offer is a route decision', () => {
  // If the offer stops being a route decision, the exception above must go with it.
  expect(ROUTE_STATES.some((route) => route.name === 'pilot offer modal' && route.scope === 'dilemma-modal')).toBe(true);
});
