/**
 * DZ-02 (#220) in the preview export: a routed save (FIXTURE: a played production fixture adopted
 * by preview, entered into campaign rules and promoted through the engine, since no route content
 * exists yet) shows its arrangement beside the phase, and keeps it through a reload (V12).
 */
import { makeFixtures } from '../../scripts/make-fixtures';
import { CONTENT as PREVIEW } from '../../src/content/preview';
import { recordRouteEvent } from '../../src/engine/access';
import { activateCampaignRules, exportSave, importSave, type ActionResult, type GameState } from '../../src/engine';
import { boot, expect, openSave, test } from './helpers';

function must(result: ActionResult): GameState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function pilotCode(): string {
  const code = makeFixtures()['guest-skimmer'];
  if (!code) throw new Error('Missing fixture guest-skimmer');
  const active = must(activateCampaignRules(importSave(code, PREVIEW), PREVIEW));
  return exportSave(must(recordRouteEvent(active, 'PROMOTION', PREVIEW)));
}

test('a promoted preview run names its arrangement beside the phase and keeps it on reload', async ({ page }) => {
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(pilotCode());
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT');
  await expect(page.getByTestId('phase-value').first()).toHaveText('0');
  await page.reload();
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT');
});
