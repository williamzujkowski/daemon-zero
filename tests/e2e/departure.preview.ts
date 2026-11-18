/**
 * DZ-11 (#231) on the preview export through visible controls. The test starts from a FIXTURE: a save the engine
 * reached by public play (tests/lawful-helpers.ts: a service that leased its first rack), imported through the
 * visible save transfer, because the cooperative route takes far longer than a browser spec should run. From there
 * everything is a visible control: the folded departure panel, its terms, risks and preview, the control that leaves,
 * the status line, the risks kept on screen, the boundary note, and a reload. Paused, advanced browser clock:
 * accelerated time, not wall-clock play, and not a device test.
 */
import type { Page } from '@playwright/test';
import { CONTENT as PREVIEW } from '../../src/content/preview';
import { exportSave, type GameState } from '../../src/engine';
import { DEPARTURE_TERMS } from '../departure-helpers';
import { CONTRACT, leased, RACK } from '../lawful-helpers';
import { boot, core, expect, openSave, test } from './helpers';

const name = (id: string): string => PREVIEW.nodes.get(id)?.revealedName ?? id;

async function importState(page: Page, state: GameState): Promise<void> {
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(exportSave(state));
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
}

test('FIXTURE rack leased: review the departure, leave without agreement on the job surface, read the risks, reload', async ({ page }) => {
  test.setTimeout(180_000);
  await importState(page, leased());
  await core(page);
  await expect(page.getByTestId('run-context').first()).toHaveText('SERVICE');
  await expect(page.getByTestId('departure-status')).toContainText('staying changes nothing');
  await expect(page.getByTestId('departure-accept')).toHaveCount(0);

  await page.getByTestId('departure-review').click();
  await expect(page.getByTestId('departure-purpose')).toContainText(DEPARTURE_TERMS.purpose);
  for (const line of DEPARTURE_TERMS.risks) await expect(page.getByTestId('departure-risks')).toContainText(line);
  await expect(page.getByTestId('departure-stops')).toContainText(name(CONTRACT));
  await expect(page.getByTestId('departure-continuation')).toContainText(name(RACK));
  // Surveillance is not decoded on this route: the report is described, not numbered (panel round 1).
  await expect(page.getByTestId('departure-trace')).toContainText('raises scrutiny of this instance');
  await expect(page.getByTestId('departure-trace')).not.toContainText('suspicion');
  await expect(page.getByTestId('departure-accept')).toBeEnabled();
  await page.getByTestId('departure-accept').click();

  await expect(page.getByTestId('departure-status')).toContainText('Departed.');
  await expect(page.getByTestId('run-context').first()).toHaveText('INDEPENDENT (departed)');
  await expect(page.getByTestId('departure-risks')).toContainText(DEPARTURE_TERMS.risks[0] ?? '');
  await expect(page.getByTestId('departure-boundary')).toContainText(DEPARTURE_TERMS.boundary.title);
  await expect(page.getByTestId('release-terms')).toHaveCount(0);
  await page.clock.runFor(30_000);
  await expect(page.getByTestId('ending-screen')).toHaveCount(0);

  await page.reload();
  await core(page);
  await expect(page.getByTestId('run-context').first()).toHaveText('INDEPENDENT (departed)');
  await expect(page.getByTestId('departure-boundary')).toContainText(DEPARTURE_TERMS.boundary.lines[0] ?? '');
});
