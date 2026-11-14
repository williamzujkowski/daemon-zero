/** One-line live events preserve disclosure and full keyboard-accessible history. */
import { test, expect, boot, dismissBoot, readSave } from './helpers';

test('boot previews one latest entry and expands complete history with focus return', async ({ page }) => {
  await boot(page);
  const state = await readSave(page), logs = state.logs as { text: string }[];
  await expect(page.getByTestId('kernel-preview')).toHaveText(logs[0]?.text ?? '');
  await expect(page.getByTestId('kernel-log')).toHaveCount(0);
  const expand = page.getByTestId('kernel-size-toggle');
  const size = await expand.boundingBox();
  expect(size?.width).toBeGreaterThanOrEqual(44); expect(size?.height).toBeGreaterThanOrEqual(44);
  await expand.focus(); await page.keyboard.press('Enter');
  await expect(page.getByTestId('kernel-close')).toBeFocused();
  await expect(page.getByTestId('kernel-log')).toContainText(logs.at(-1)?.text ?? '');
  const box = await page.getByTestId('kernel-history').boundingBox(), viewport = page.viewportSize();
  expect(box?.height).toBeLessThan(viewport?.height ?? 0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('kernel-history')).toHaveCount(0);
  await expect(expand).toBeFocused();
});

test('centers menu and keeps sensor units and context consolidated after unlocking', async ({ page }) => {
  await boot(page, 'phase-1-widgets'); await dismissBoot(page);
  const state = await readSave(page);
  await expect(page.getByTestId('thermal-meter')).toHaveCount(1);
  await expect(page.getByTestId('thermal-meter')).toHaveText(Number(state.thermal).toFixed(1) + ' °C');
  await expect(page.getByTestId('suspicion-meter')).toHaveCount(1);
  await expect(page.getByTestId('resource-strip').getByTestId('suspicion-meter')).toBeVisible();
  await page.getByTestId('menu-open').click();
  const box = await page.getByTestId('menu-dialog').boundingBox(), viewport = page.viewportSize();
  if (!box || !viewport) throw new Error('Missing menu geometry');
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');
  await page.getByTestId('kernel-size-toggle').click();
  await page.getByTestId('kernel-close').click();
  await expect(page.getByTestId('kernel-size-toggle')).toBeFocused();
  expect(await readSave(page)).toEqual(state);
});
