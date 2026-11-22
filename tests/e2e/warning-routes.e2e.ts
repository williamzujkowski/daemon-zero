/**
 * Warning routes in a real browser (#369, #435 panel): the overheat remedy's PROC word is a link that a keyboard user can
 * reach and take with Enter, and a pointer user with a click; either opens the process dialog. It is a full 44 px target.
 */
import { expect, test } from '@playwright/test';
import { openStage } from './atlas/open';
import { STAGES } from './atlas/stages';

const overheat = STAGES.find((row) => row.id === 'p1-overheat');

for (const how of ['keyboard', 'pointer'] as const) {
  test(`the overheat remedy's PROC route opens the process dialog by ${how}`, async ({ page }) => {
    if (overheat === undefined) throw new Error('No p1-overheat stage');
    await openStage(page, overheat);
    if (await page.getByTestId('tab-SENSORS').count() > 0) await page.getByTestId('tab-SENSORS').click();
    const link = page.getByTestId('route-proc');
    await expect(link).toHaveAttribute('role', 'link');
    const box = await link.boundingBox();
    expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);
    if (how === 'keyboard') { await link.focus(); await page.keyboard.press('Enter'); } else await link.click();
    await expect(page.getByTestId('processes-dialog')).toBeVisible();
  });
}
