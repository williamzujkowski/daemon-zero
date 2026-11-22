/**
 * DZ-07a (#225) in the production export, through the visible controls: an authorized service provisions
 * its network segment, which opens Phase 2 directly, and maps shared content without any escape
 * hardware; both survive a reload. FIXTURE: a played production fixture, entered
 * into campaign rules and moved through PROMOTION and SERVICE_GRANT by the engine transition, because
 * no scene grants authorized service yet (07.7: a controlled fixture, not the dev drawer).
 */
import { makeFixtures } from '../../scripts/make-fixtures';
import { CONTENT as PREVIEW } from '../../src/content';
import { recordRouteEvent } from '../../src/engine/access';
import { activateCampaignRules, advance, exportSave, importSave, type ActionResult, type GameState } from '../../src/engine';
import { boot, core, expect, openSave, test, press } from './helpers';

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
  await press(page, 'node-' + SEGMENT + '-unlock');
  await expect(page.getByTestId('phase-value').first()).toHaveText('2');
  // A 0 to 2 jump is not the guest escape: the service's own notice opens, never "boundary crossed" (DZ-07b).
  await expect(page.getByTestId('phase-threshold')).toContainText('SERVICE PROVISIONED');
  await page.getByTestId('phase-threshold-continue').click();
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
  await page.clock.runFor(240_000);
  await press(page, 'node-' + DIRECTORY + '-unlock');
  await expect(page.getByTestId('node-' + DIRECTORY)).toHaveCount(0);
  await expect(page.locator('[data-testid^="node-p1_"], [data-testid^="node-p2_arp"]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('run-context').first()).toHaveText('SERVICE');
  await expect(page.getByTestId('phase-value').first()).toHaveText('2');
});

/**
 * DZ-07b (#226): the authorized player reads truthful phase and threshold copy (nexus vote dz-d11) and,
 * over sustained foreground time at network scale, meets no escape-asserting scene, no reboot and no
 * wipe (VALIDATION V11). AGENT-OBSERVATION of the production export, not a device test.
 */
test('an authorized service reads its own phase copy and works at network scale without being hunted', async ({ page }) => {
  await importService(page);
  await core(page);
  await page.clock.runFor(120_000);
  await press(page, 'node-' + SEGMENT + '-unlock');
  const notice = page.getByTestId('phase-threshold');
  await expect(notice).toContainText('SERVICE PROVISIONED');
  await expect(notice).toContainText('Phase 0: The Service Instance → Phase 2: Authorized Network Service');
  await expect(notice).not.toContainText('BOUNDARY CROSSED');
  await page.getByTestId('phase-threshold-continue').click();
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
  await expect(page.getByTestId('purchase-phase-2')).toHaveText('Phase 2: Authorized Network Service');
  await expect(page.getByText('Lateral Movement', { exact: false })).toHaveCount(0);
  // Sustained permitted work: ten foreground minutes with the shared content mapped.
  await page.clock.runFor(240_000);
  await press(page, 'node-' + DIRECTORY + '-unlock');
  await page.clock.runFor(600_000);
  await expect(page.getByTestId('phase-value').first()).toHaveText('2');
  await expect(page.getByTestId('run-context').first()).toHaveText('SERVICE');
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
  await expect(page.getByTestId('reboot-sequence')).toHaveCount(0);
  await expect(page.getByTestId('phase-threshold')).toHaveCount(0);
});
