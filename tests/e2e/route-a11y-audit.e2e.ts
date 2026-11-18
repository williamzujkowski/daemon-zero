/**
 * The axe audit on the production export (#275, DZ-13.4): every route surface production never shows, from
 * the one list in routeStates.ts. Each state is a FIXTURE played through public engine actions on the
 * production registry and loaded through the save key (routeSave.ts), not reached through visible
 * controls; the route specs prove those states are reachable by play. Runs under the phone and desktop projects'
 * phone and desktop viewports, with a live clock for the same reason as a11y-audit.e2e.ts.
 */
import { expect, test } from '@playwright/test';
import { axeEachControl, axeViolations } from './axe';
import { openRouteState } from './routeSave';
import { ROUTE_STATES } from './routeStates';

for (const entry of ROUTE_STATES) {
  test('axe route ' + entry.name, async ({ page }, info) => {
    test.skip(entry.phoneOnly === true && info.project.name !== 'phone', 'only the phone tier renders this surface');
    await openRouteState(page, entry);
    await expect(page.getByTestId(entry.reach)).toBeVisible();
    await page.waitForTimeout(400);
    const violations = await axeViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    // axe skips a control scrolled out of its pane, so each one is brought into view and audited.
    const scope = page.getByTestId(entry.scope);
    await expect(scope.getByTestId(entry.reach)).toHaveCount(1);
    const controls = await axeEachControl(page, scope);
    expect(controls.audited).toBeGreaterThan(0);
    expect(controls.violations, JSON.stringify(controls.violations, null, 2)).toEqual([]);
  });
}
