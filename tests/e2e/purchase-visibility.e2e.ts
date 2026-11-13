/** Forfeited evaluation disappears; temporarily unaffordable paths and resource gates survive. */
import { CONTENT } from '../../src/content';
import { test, expect, boot, dismissBoot } from './helpers';

test('keeps one resource strip and removes an evaluation forfeited through a UI purchase', async ({ page }) => {
  await boot(page, 'evaluation-ready'); await dismissBoot(page);
  const evaluation = [...CONTENT.nodes.values()].find((node) => node.effects.forcesEnding === 'SHIPPED');
  const probe = evaluation?.requirements?.forbidsNodes?.[0];
  if (!evaluation || !probe) throw new Error('Missing evaluation exclusion');
  await expect(page.getByTestId('node-' + evaluation.id)).toBeVisible();
  for (const id of CONTENT.nodes.get(probe)?.prerequisites ?? []) {
    const buy = page.getByTestId('node-' + id + '-unlock');
    if (await buy.count()) await buy.click();
  }
  await page.getByTestId('node-' + probe + '-unlock').click();
  await expect(page.getByTestId('node-' + evaluation.id)).toHaveCount(0);
  await expect(page.getByTestId('res-cycles')).toBeVisible();
  await expect(page.getByTestId('widget-CYCLE_COUNTER_AND_RATE')).toHaveCount(0);
  await page.reload(); await dismissBoot(page);
  await expect(page.getByTestId('node-' + evaluation.id)).toHaveCount(0);
});
