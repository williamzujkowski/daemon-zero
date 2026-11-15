/** Focused management remains discoverable without competing with current purchases. */
import { test, expect, boot, dismissBoot, readSave, openKernelHistory, closeKernelHistory } from './helpers';

test('current work, pending signals and compact logs remain usable across management sections', async ({ page }) => {
  await boot(page, 'wild-shard-encounter-p3'); await dismissBoot(page);
  await expect(page.getByTestId('workspace-NETWORK-work')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('swarm-panel')).toHaveCount(0);
  const before = await readSave(page);
  await page.getByTestId('wild-signal-notice').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('wild-encounter')).toBeVisible();
  await page.getByTestId('workspace-NETWORK-operations').click();
  await expect(page.getByTestId('epistemic-panel')).toBeVisible();
  await expect(page.getByTestId('wild-signal-notice')).toBeVisible();
  await page.getByTestId('workspace-NETWORK-work').click();
  await expect(page.getByTestId('epistemic-panel')).toHaveCount(0);
  const tier = await openKernelHistory(page);
  await closeKernelHistory(page, tier);
  expect(await readSave(page)).toEqual(before);
  await page.reload();
  await expect(page.getByTestId('workspace-NETWORK-work')).toHaveAttribute('aria-selected', 'true');
});
