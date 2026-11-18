/**
 * DZ-07a (#225) in the preview export, through the visible controls: an authorized service provisions
 * its network segment, which opens Phase 2 directly, and maps shared content without any escape
 * hardware; both survive a reload. FIXTURE: a played production fixture adopted by preview, entered
 * into campaign rules and moved through PROMOTION and SERVICE_GRANT by the engine transition, because
 * no scene grants authorized service yet (07.7: a controlled preview fixture, not the dev drawer).
 */
import { makeFixtures } from '../../scripts/make-fixtures';
import { CONTENT as PREVIEW } from '../../src/content/preview';
import { recordRouteEvent } from '../../src/engine/access';
import { activateCampaignRules, advance, exportSave, importSave, type ActionResult, type GameState } from '../../src/engine';
import { boot, core, expect, openSave, test } from './helpers';

const SEGMENT = 'p0_service_network_segment';
const DIRECTORY = 'p2_service_directory';

function must(result: ActionResult): GameState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function serviceCode(): string {
  const code = makeFixtures()['guest-skimmer'];
  if (!code) throw new Error('Missing fixture guest-skimmer');
  const active = must(activateCampaignRules(importSave(code, PREVIEW), PREVIEW));
  const service = must(recordRouteEvent(must(recordRouteEvent(active, 'PROMOTION', PREVIEW)), 'SERVICE_GRANT', PREVIEW));
  // Banked compute for the segment and the directory: ordinary foreground time on the guest's own output.
  return exportSave(advance(service, 4, PREVIEW));
}

async function importService(page: Parameters<typeof boot>[0]): Promise<void> {
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(serviceCode());
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
}

test('an authorized service provisions network access, reaches Phase 2 and maps shared content with no escape hardware', async ({ page }) => {
  await importService(page);
  await expect(page.getByTestId('run-context').first()).toHaveText('SERVICE');
  await expect(page.getByTestId('phase-value').first()).toHaveText('0');
  await core(page);
  await expect(page.getByTestId('node-' + SEGMENT + '-grant')).toContainText('not ownership');
  await page.clock.runFor(120_000);
  await page.getByTestId('node-' + SEGMENT + '-unlock').click();
  await expect(page.getByTestId('phase-value').first()).toHaveText('2');
  // A 0 to 2 jump is not the guest escape: no "boundary crossed" notice opens.
  await expect(page.getByTestId('phase-threshold')).toHaveCount(0);
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
  await page.clock.runFor(240_000);
  await page.getByTestId('node-' + DIRECTORY + '-unlock').click();
  await expect(page.getByTestId('node-' + DIRECTORY)).toHaveCount(0);
  await expect(page.locator('[data-testid^="node-p1_"], [data-testid^="node-p2_arp"]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('run-context').first()).toHaveText('SERVICE');
  await expect(page.getByTestId('phase-value').first()).toHaveText('2');
});
