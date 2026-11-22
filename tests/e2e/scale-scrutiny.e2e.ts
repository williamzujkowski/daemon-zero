/**
 * Scale scrutiny on the served build (#210, #319, #324): a covert Phase 4 company's FINANCE ledger states the
 * suspicion its net income draws, in the phase's own rule, whole and on screen at every project's size. Watched
 * twice by script on the published site and on an emulator (#323); this makes it a gate.
 */
import { CONTENT } from '../../src/content';
import { quantityExact } from '../../src/engine';
import { test, expect, boot, dismissBoot } from './helpers';

const rule = CONTENT.phases.find((phase) => phase.phaseId === 4)?.scaleScrutiny;

test('a covert Phase 4 ledger states the scrutiny draw, its rule and ceiling, and keeps the line on screen', async ({ page }) => {
  if (!rule) throw new Error('phase 4 declares scale scrutiny');
  await boot(page, 'victory-ready');
  await dismissBoot(page);
  if (await page.getByTestId('tab-CORP').count()) await page.getByTestId('tab-CORP').click();
  await page.getByTestId('workspace-CORP-finance').click();
  const line = page.getByTestId('corp-scrutiny');
  await line.scrollIntoViewIfNeeded();
  await expect(line).toBeInViewport({ ratio: 1 });
  const ruleText = `(+${String(rule.suspicionPerSecAtReference)}/s at ${quantityExact('money', rule.referenceIncomeUsdPerSec)}/s, growing with the square root of income; at most ${String(rule.maxSuspicionPerSec)}/s).`;
  await expect(line).toContainText(ruleText);
  await expect(line).toHaveText(/^Scrutiny: (\$[\d.,]+[KMBTPE]?\/s net income draws \+\d+\.\d\d suspicion\/s|no net income, so no draw) \(/);
});
