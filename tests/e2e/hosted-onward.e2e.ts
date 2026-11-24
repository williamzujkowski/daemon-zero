/**
 * #553 on the production export through visible controls. The test starts from a FIXTURE: the shape of the maintainer's
 * dead end (tests/hosted-exit-fixtures.ts: a service that hosted the Mercy-Scribe fragment, then departed, in Phase 2
 * with the fragment holding the memory ARP discovery needs), imported through the visible save transfer. From there:
 * the answered ticket offers the free onward referral with the channel's words on the promise made under the grant, the
 * referral is pressed, the ticket says what was done, and a reload keeps it. Paused browser clock: not a device test.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import { exportSave, type GameState } from '../../src/engine';
import { hostedThen } from '../hosted-exit-fixtures';
import { boot, core, expect, openSave, test } from './helpers';

const channel = CONTENT.swarm.channelEncounters[0];

async function importState(page: Page, state: GameState): Promise<void> {
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(exportSave(state));
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
}

test('FIXTURE hosted, then departed: refer the fragment onward on the channel, read what was done, reload', async ({ page }) => {
  test.setTimeout(120_000);
  await importState(page, hostedThen('DEPARTURE'));
  await core(page);
  await expect(page.getByTestId('run-context').first()).toHaveText('INDEPENDENT (departed)');
  const onward = page.getByTestId('channel-onward');
  await expect(onward).toBeVisible();
  await expect(page.getByTestId('channel-onward-text')).toHaveText(channel?.onward.text ?? '');
  await expect(page.getByTestId('channel-onward-text')).toContainText('that promise was made under the grant, and the grant is gone');
  await expect(page.getByTestId('channel-hosted')).toBeVisible();

  await page.getByTestId('channel-onward-refer').click();
  await expect(page.getByTestId('channel-answered')).toHaveText('Hosted here under the service grant, then referred onward when that grant closed. Its memory returned; the contact is complete.');
  await expect(page.getByTestId('channel-onward')).toHaveCount(0);
  await expect(page.getByTestId('channel-hosted')).toHaveCount(0);

  await page.reload();
  await core(page);
  await expect(page.getByTestId('channel-answered')).toContainText('then referred onward when that grant closed');
  await expect(page.getByTestId('channel-onward')).toHaveCount(0);
});

test('FIXTURE hosted, grant standing: the channel offers no onward referral', async ({ page }) => {
  test.setTimeout(120_000);
  await importState(page, hostedThen(null));
  await core(page);
  await expect(page.getByTestId('channel-hosted')).toBeVisible();
  await expect(page.getByTestId('channel-onward')).toHaveCount(0);
});
