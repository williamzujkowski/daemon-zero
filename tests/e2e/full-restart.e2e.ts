/** Production full restart backs up first, requires confirmation and survives page reload. */
import { CONTENT } from '../../src/content';
import { createInitialState, importSave, serialize } from '../../src/engine';
import { test, expect, boot, dismissBoot, readSave } from './helpers';

test('backs up a live campaign and resets all progress only after confirmation', async ({ page }) => {
  await boot(page, 'phase5-midgame'); await dismissBoot(page);
  const before = await readSave(page);
  await page.getByTestId('save-open').click(); await page.getByTestId('save-export').click();
  const code = await page.getByTestId('save-code').inputValue();
  expect(importSave(code, CONTENT).currentPhase).toBe(5);
  await page.getByTestId('save-reset').click();
  await expect(page.getByTestId('save-reset-dialog')).toContainText('knowledge');
  await page.getByTestId('save-reset-cancel').click();
  expect(await readSave(page)).toEqual(before);
  await page.getByTestId('save-reset').click(); await page.getByTestId('save-reset-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
  await expect(page.getByTestId('res-cycles')).toHaveCount(0);
  await expect(page.getByTestId('manual-cycle')).toBeVisible();
  const fresh = JSON.parse(serialize(createInitialState(CONTENT))) as Record<string, unknown>;
  expect(await readSave(page)).toEqual(fresh);
  await page.reload();
  await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  expect(await readSave(page)).toEqual(fresh);
  await expect(page.getByTestId('reboot-sequence')).toHaveCount(0);
  await page.getByTestId('save-open').click(); await page.getByTestId('save-code').fill(code);
  await page.getByTestId('save-import').click(); await page.getByTestId('save-import-confirm').click();
  expect(await readSave(page)).toEqual(before);
});
