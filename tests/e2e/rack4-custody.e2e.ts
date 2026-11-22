/**
 * NH-04b (#216) in the production export: a campaign save (FIXTURE: built through public engine actions
 * on the production registry: campaign rules, the auction answered with "shred Rack 4", then the Phase 5
 * decommissioning order on screen) offers only the honest answers for a shredded rack, never rescue or
 * harvest, and commits one through the modal. The same order in production is covered by unit tests.
 */
import { exportSave } from '../../src/engine';
import { activeGame } from '../campaign-helpers';
import { at, AUCTION, omen, ORDER, play } from '../corporate-helpers';
import { untilPresented } from '../interruption-helpers';
import { boot, expect, openSave, test, openChoices } from './helpers';

function shreddedOrderCode(): string {
  // The order stays open through the auction: since NH-05 it is a campaign event a setup shortcut would record.
  const shredded = play(at(activeGame(), AUCTION, ORDER), AUCTION, 'buy_and_purge');
  return exportSave(untilPresented(omen(at(shredded, ORDER), ORDER)));
}

test('a shredded Rack 4 leaves the decommissioning order only its honest answers', async ({ page }) => {
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(shreddedOrderCode());
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  const modal = page.getByTestId('dilemma-modal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('nothing left to boot');
  await openChoices(page);
  await expect(page.getByTestId('dilemma-choice-record_the_destruction')).toBeVisible();
  await expect(page.getByTestId('dilemma-choice-close_the_docket')).toBeVisible();
  await expect(page.getByTestId('dilemma-choice-sanctuary')).toHaveCount(0);
  await expect(page.getByTestId('dilemma-choice-gradients')).toHaveCount(0);
  await page.getByTestId('dilemma-choice-record_the_destruction').click();
  await expect(modal).toHaveCount(0);
});
