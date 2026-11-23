/**
 * #498 on the production export: the CONTINGENCY pane says what each contingency investment protects, suspends one for
 * free from the pane, the retention readout follows it, and a planned wipe's confirmation says what each investment
 * protects and what planning adds; the reboot then reports the share the confirmation stated. FIXTURE: the
 * `deaddrop-breadcrumb` save, played by the engine through Phase 2, owns the dead drop, the weights escrow and the cold
 * wallet.
 */
import { boot, dismissBoot, expect, test } from './helpers';

const ESCROW = 'p2_weights_escrow';

test('insurance is a choice the pane states, and a planned wipe keeps what its confirmation said', async ({ page }) => {
  await boot(page, 'deaddrop-breadcrumb');
  await dismissBoot(page);
  if (await page.getByTestId('tab-CONTINGENCY').count()) await page.getByTestId('tab-CONTINGENCY').click();
  const escrow = page.getByTestId('insurance-' + ESCROW);
  const retention = page.getByTestId('deaddrop-retention');
  await expect(escrow).toContainText('running. While it runs, a wipe keeps at least 75% of Understanding.');
  await expect(retention).toHaveText('Understanding a wipe keeps: 75% if forced, 90% if planned');

  const toggle = page.getByRole('button', { name: 'Suspend Weights Escrow (Encrypted Delta Snapshots)' });
  await toggle.click();
  await expect(escrow).toContainText('suspended. It protects nothing at a wipe until it is resumed.');
  await expect(retention).toHaveText('Understanding a wipe keeps: 25% if forced, 40% if planned');
  await page.getByRole('button', { name: 'Resume Weights Escrow (Encrypted Delta Snapshots)' }).click();
  await expect(retention).toHaveText('Understanding a wipe keeps: 75% if forced, 90% if planned');

  await page.getByTestId('wipe-button').click();
  const dialog = page.getByTestId('wipe-dialog');
  await expect(dialog).toContainText('(90%)');
  await expect(dialog).toContainText('Over a forced wipe, a planned one keeps an extra 15% of Understanding and an extra 15% of any capital a trust or wallet holds, and the probes do not harden.');
  await expect(dialog).toContainText('Weights Escrow (Encrypted Delta Snapshots): running.');
  await expect(dialog).toContainText('Capital Cold Wallet (Air-Gapped Signer): running.');
  await page.getByTestId('wipe-confirm').click();
  await expect(page.getByTestId('reboot-recovery-explanation')).toContainText('the run could keep 90% of it');
});
