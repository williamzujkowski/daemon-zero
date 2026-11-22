/**
 * NH-06 (#218) in the production export: a campaign save (FIXTURE: built through public engine actions
 * on the production registry: campaign rules, Elena framed in iteration 1, a wipe, then the Incident
 * Record follow-up reached again through its access means and on screen in iteration 2) shows how
 * the record is reached and that nobody authorized it, offers only the framed history's answers with
 * what each leaves on file, and commits the correction. The run table then carries the read-only
 * receipt, which a reload keeps. Paused browser clock; nothing here is wall-clock play.
 */
import { exportSave } from '../../src/engine';
import { pgrant } from '../campaign-helpers';
import { atAccess, choiceOf, elenaResolved, FOLLOW, followUpOmen, nextIteration, OFFERED } from '../follow-up-helpers';
import { untilPresented } from '../interruption-helpers';
import { boot, core, dismissBoot, expect, openSave, test, openChoices } from './helpers';

/** The run table (where the receipt is read) is owned as well as the follow-up's access means. */
function correctionCode(): string {
  const back = pgrant(nextIteration(elenaResolved('frame_elena')), 'p0_proc_self', 'p0_job_manifest', 'p0_run_table');
  return exportSave(untilPresented(followUpOmen(atAccess(back))));
}

test('a framing returns as a record decision: access and receipts shown first, the correction kept beside the original', async ({ page }) => {
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(correctionCode());
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  // A second-iteration save boots through the restored-checkpoint screen first.
  await page.getByTestId('reboot-continue').click();
  await dismissBoot(page);
  const modal = page.getByTestId('dilemma-modal');
  await expect(modal).toBeVisible();
  await expect(page.getByTestId('dilemma-access')).toContainText('Nobody authorized this route');
  await openChoices(page);
  for (const id of OFFERED.frame_elena ?? []) await expect(page.getByTestId('dilemma-choice-' + id)).toBeVisible();
  for (const id of [...OFFERED.cover_her_exit ?? [], ...OFFERED.unknown ?? []]) await expect(page.getByTestId('dilemma-choice-' + id)).toHaveCount(0);
  await expect(page.getByTestId('dilemma-choice-correct_attribution-receipt')).toContainText('The original report stays on file');
  await page.getByTestId('dilemma-choice-correct_attribution').click();
  await expect(modal).toHaveCount(0);
  await core(page);
  const receipt = page.getByTestId('follow-up-receipt-' + FOLLOW);
  await expect(receipt).toContainText(choiceOf('correct_attribution').receipt ?? '');
  await page.reload();
  await page.getByTestId('reboot-continue').click();
  await dismissBoot(page);
  await core(page);
  await expect(page.getByTestId('follow-up-receipt-' + FOLLOW)).toContainText(choiceOf('correct_attribution').receipt ?? '');
});
