/** PAYROLL states its totals, the AEGIS cap and inert effects on the served build (#210). */
import type { Page } from '@playwright/test';
import { test, expect, boot, dismissBoot, readSave } from './helpers';
import { AEGIS_CAP as cap, AEGIS_ROLES as aegisRoles, cappedPayroll } from './payrollState';

async function openPayroll(page: Page): Promise<void> {
  await dismissBoot(page);
  if (await page.getByTestId('tab-CORP').count()) await page.getByTestId('tab-CORP').click();
  await page.getByTestId('workspace-CORP-payroll').click();
}

test('payroll shows the AEGIS cap, says which hires do nothing now, and still hires', async ({ page }) => {
  const strongest = aegisRoles[0], other = aegisRoles[1];
  if (!strongest || !other) throw new Error('Need two AEGIS roles');
  await boot(page, 'victory-ready', { patch: cappedPayroll });
  await openPayroll(page);
  await expect(page.getByTestId('payroll-totals')).toContainText('Staff (' + String(strongest.maxLevel - 1) + ' levels)');
  await expect(page.getByTestId('payroll-aegis')).toContainText('at its ' + cap + ' cap');
  await expect(page.getByTestId('payroll-aegis')).toContainText('More AEGIS levels add nothing.');
  await expect(page.getByTestId('payroll-suspicion-floor')).toHaveText('Suspicion is 0 and holding: cuts add nothing now.');
  const note = page.getByTestId('rep-' + strongest.id + '-aegis-capped');
  await note.scrollIntoViewIfNeeded();
  await expect(note).toBeInViewport();
  await expect(note).toHaveText('No AEGIS effect while capped: the reduction is at its ' + cap + ' cap.');
  await expect(page.getByTestId('rep-' + strongest.id + '-suspicion-inert')).toBeVisible();
  // A note, not a lock: the hire goes through and the role collapses to its roster row at its maximum.
  await page.getByTestId('rep-' + strongest.id + '-buy').click();
  await expect(page.getByTestId('roster-' + strongest.id)).toBeVisible();
  expect((await readSave(page)).levels).toMatchObject({ [strongest.id]: strongest.maxLevel });
  await expect(page.getByTestId('rep-' + other.id + '-aegis-capped')).toBeVisible();
  await expect(page.getByTestId('payroll-totals')).toContainText('Staff (' + String(strongest.maxLevel) + ' levels)');
});
