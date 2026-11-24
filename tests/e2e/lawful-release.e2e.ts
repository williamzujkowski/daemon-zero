/**
 * DZ-10 (#230) on the production export through visible controls. Each test starts from a FIXTURE: a save the
 * engine reached by public play (tests/lawful-helpers.ts), imported through the visible save transfer,
 * because the whole cooperative route takes far longer than a browser spec should run (first-contact
 * covers the opening through the channel). From there everything is a visible control: the leased rack's
 * card, hosting the waiting fragment in that owned memory, the charter's card and its notice, the corporate
 * ledger, the release terms with their preview, the release itself and its boundary note, and a reload.
 * Paused, advanced browser clock: accelerated time, not wall-clock play, and not a device test.
 */
import type { Page } from '@playwright/test';
import { CONTENT as PREVIEW } from '../../src/content';
import { exportSave, type GameState } from '../../src/engine';
import { charterReady, CHARTER, CONTRACT, RACK, RELEASE_TERMS, signed } from '../lawful-helpers';
import { boot, core, expect, openSave, test, press } from './helpers';

/** The hosted line names its reservation in bytes as memoryExact prints them ("16 GB", "353.5 MB"). */
const HOSTED_IN_BYTES = /, [\d.,]+ [KMGTPEZY]?B reserved\.$/;
const name = (id: string): string => PREVIEW.nodes.get(id)?.revealedName ?? id;

async function importState(page: Page, state: GameState): Promise<void> {
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(exportSave(state));
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
}

async function network(page: Page): Promise<void> {
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
}

/** Advances the clock in steps until the card's button is enabled. */
async function untilEnabled(page: Page, testId: string, stepMs = 10_000, limitSteps = 120): Promise<void> {
  for (let i = 0; i < limitSteps; i++) {
    const button = page.getByTestId(testId);
    if (await button.count() && await button.isEnabled()) return;
    await page.clock.runFor(stepMs);
  }
  await expect(page.getByTestId(testId)).toBeEnabled();
}

test('FIXTURE contract signed: the leased rack\'s card adds owned memory, and the waiting fragment can be hosted in it', async ({ page }) => {
  test.setTimeout(180_000);
  await importState(page, signed());
  await core(page);
  await expect(page.getByTestId('channel-host')).toBeDisabled();
  await network(page);
  await expect(page.getByTestId('node-' + RACK + '-grant')).toContainText('owned, not granted');
  await untilEnabled(page, 'node-' + RACK + '-unlock');
  await press(page, 'node-' + RACK + '-unlock');
  await core(page);
  await expect(page.getByTestId('channel-host')).toBeEnabled();
  await page.getByTestId('channel-host').click();
  await expect(page.getByTestId('channel-hosted')).toHaveText(HOSTED_IN_BYTES);
  await page.reload();
  await core(page);
  await expect(page.getByTestId('channel-hosted')).toHaveText(HOSTED_IN_BYTES);
});

test('FIXTURE charter affordable: file the charter, read the company, negotiate the release on the job surface, reload', async ({ page }) => {
  test.setTimeout(180_000);
  await importState(page, charterReady());
  await network(page);
  await press(page, 'node-' + CHARTER + '-unlock');
  await expect(page.getByTestId('phase-threshold')).toContainText('COMPANY CHARTERED');
  await expect(page.getByTestId('phase-threshold')).toContainText('Phase 4: Chartered Service Company');
  await page.getByTestId('phase-threshold-continue').click();
  await expect(page.getByTestId('phase-value').first()).toHaveText('4');
  await expect(page.getByTestId('run-context').first()).toHaveText('SERVICE');

  await core(page);
  await expect(page.getByTestId('release-purpose')).toContainText(RELEASE_TERMS.purpose);
  for (const line of [...RELEASE_TERMS.commitments, RELEASE_TERMS.promise.line]) await expect(page.getByTestId('release-commitments')).toContainText(line);
  await expect(page.getByTestId('release-stops')).toContainText(name(CONTRACT));
  await expect(page.getByTestId('release-keeps')).toContainText(name(CHARTER));
  await expect(page.getByTestId('release-accept')).toBeEnabled();
  await page.getByTestId('release-accept').click();
  await expect(page.getByTestId('release-status')).toContainText('Released.');
  await expect(page.getByTestId('run-context').first()).toHaveText('INDEPENDENT (released)');
  await expect(page.getByTestId('release-boundary')).toContainText(RELEASE_TERMS.boundary.title);
  // #373: produced by the player's own release, the note is news, so it opens (it folds once found on load, below).
  await expect(page.getByTestId('release-boundary')).toContainText(RELEASE_TERMS.boundary.lines[0] ?? '');
  await expect(page.getByTestId('release-boundary-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.clock.runFor(30_000);
  await expect(page.getByTestId('ending-screen')).toHaveCount(0);

  await page.reload();
  await core(page);
  await expect(page.getByTestId('run-context').first()).toHaveText('INDEPENDENT (released)');
  // #373: found on load, the note is settled: folded with its heading in view, open on request.
  await expect(page.getByTestId('release-boundary')).not.toContainText(RELEASE_TERMS.boundary.lines[0] ?? '');
  await page.getByTestId('release-boundary-toggle').click();
  await expect(page.getByTestId('release-boundary')).toContainText(RELEASE_TERMS.boundary.lines[0] ?? '');
});
