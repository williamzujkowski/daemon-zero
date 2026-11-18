/**
 * #245: IMPORT SAVE CODE checks the pasted code first. A refused code stays on the save page with
 * its specific reason; only a code that loads is offered the validated-save confirmation.
 */
import { CONTENT as PREVIEW } from '../../src/content/preview';
import { createInitialState, exportSave, tick } from '../../src/engine';
import { makeFixtures } from '../../scripts/make-fixtures';
import { boot, dismissBoot, expect, openSave, readSave, test } from './helpers';

function run(save: Record<string, unknown>) {
  const { contentChannel, iteration, currentPhase, unlockedNodes, cycles } = save;
  return { contentChannel, iteration, currentPhase, unlockedNodes, cycles };
}

const refusals: [string, () => string, string][] = [
  ['garbage text', () => 'not-a-save-code', 'Save code is invalid or unsupported.'],
  ['a preview-build code', () => exportSave(tick(createInitialState(PREVIEW), 1, PREVIEW)),
    'This save comes from a preview build and cannot be loaded here.'],
];

for (const [name, code, reason] of refusals) {
  test(`${name} is refused on the save page without the validated-save confirmation`, async ({ page }) => {
    await boot(page, 'guest-skimmer'); await dismissBoot(page);
    const before = run(await readSave(page));
    await openSave(page);
    await page.getByTestId('save-code').fill(code());
    await page.getByTestId('save-import').click();
    const status = page.getByTestId('save-transfer-status');
    await expect(status).toHaveText(reason);
    await expect(status).toHaveAttribute('role', 'alert');
    await expect(status).toHaveAttribute('aria-live', 'assertive');
    await expect(page.getByTestId('save-import-dialog')).toHaveCount(0);
    await expect(page.getByTestId('save-import-confirm')).toHaveCount(0);
    await expect(page.getByTestId('save-transfer')).toBeVisible();
    await expect(page.getByTestId('menu-dialog')).not.toContainText(/validated/i);
    expect(run(await readSave(page))).toEqual(before);
  });
}

test('a valid code is offered the validated-save confirmation and replaces the run on confirm', async ({ page }) => {
  const code = makeFixtures()['tick-0'];
  if (!code) throw new Error('Missing fixture tick-0');
  await boot(page, 'guest-skimmer'); await dismissBoot(page);
  const before = run(await readSave(page));
  await openSave(page);
  await page.getByTestId('save-code').fill(code);
  await page.getByTestId('save-import').click();
  await expect(page.getByTestId('save-import-dialog')).toContainText('validated save');
  await expect(page.getByTestId('save-transfer-status')).toHaveCount(0);
  expect(run(await readSave(page))).toEqual(before);
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
  const after = run(await readSave(page));
  expect(after.unlockedNodes).not.toEqual(before.unlockedNodes);
  await page.reload();
  expect(run(await readSave(page)).unlockedNodes).toEqual(after.unlockedNodes);
});
