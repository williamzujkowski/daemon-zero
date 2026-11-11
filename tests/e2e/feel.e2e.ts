/** Reduced motion is immediate and late meters remain numeric in every palette. */
import { CONTENT } from '../../src/content';
import { test, expect, boot, dismissBoot, core } from './helpers';

test('reduced motion shows the complete unlocked name immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, 'lineage-parser-ready'); await dismissBoot(page); await core(page);
  const parser = [...CONTENT.nodes.values()].find((node) => node.phaseId === 1 && node.systemFlags.includes('REVEALS_SURVEILLANCE'));
  if (!parser) throw new Error('Missing parser');
  await page.getByTestId('node-' + parser.id + '-unlock').click();
  await expect(page.getByTestId('node-' + parser.id + '-title')).toContainText(parser.revealedName);
  await expect(page.getByTestId('node-' + parser.id + '-title')).not.toContainText('░');
});

test('late palettes preserve numeric accessible values', async ({ page }) => {
  await boot(page, 'phase-3-aegis-90'); await dismissBoot(page);
  await expect(page.getByTestId('manual-cycle')).toHaveCSS('border-top-color', 'rgb(0, 229, 255)');
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
  const meter = page.getByTestId('aegis-lock');
  await expect(meter).toHaveAttribute('aria-label', 'AEGIS lock');
  await expect(meter).toHaveAttribute('aria-valuetext', /90/);
  await expect(meter).toContainText('90.0 / 100%');
});
