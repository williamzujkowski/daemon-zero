/** The persisted pause in a real browser (WCAG 2.2.2, #347): time stops, survives a reload, and resumes. */
import { boot, expect, test } from './helpers';

test('Pause stops the clock, a reload comes back paused with no catch-up, and Resume lets time run', async ({ page }) => {
  await boot(page, 'phase-1-widgets');
  await page.getByTestId('menu-open').click();
  await page.getByTestId('menu-pause').click();
  await expect(page.getByTestId('menu-pause')).toHaveText('[ RESUME ]');
  await page.getByRole('button', { name: /^Close/i }).first().click();
  await expect(page.getByTestId('run-paused')).toBeVisible();
  const frozen = await page.getByTestId('sim-time').textContent();
  await page.clock.runFor(30_000);
  await expect(page.getByTestId('sim-time')).toHaveText(frozen ?? '');
  // An hour away, then a reload: still paused, and the hour did not count.
  await page.clock.fastForward(3_600_000);
  await page.reload();
  await expect(page.getByTestId('run-paused')).toBeVisible();
  await expect(page.getByTestId('sim-time')).toHaveText(frozen ?? '');
  await page.getByTestId('menu-open').click();
  await page.getByTestId('menu-pause').click();
  await page.getByRole('button', { name: /^Close/i }).first().click();
  await expect(page.getByTestId('run-paused')).toHaveCount(0);
  await page.clock.runFor(5_000);
  await expect(page.getByTestId('sim-time')).not.toHaveText(frozen ?? '');
});
