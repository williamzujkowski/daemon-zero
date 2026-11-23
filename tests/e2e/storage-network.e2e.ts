/**
 * Storage and network coupling on the production export (#484, vote-1795381354324-4br7z6t): in the dark forest the
 * cluster readout shows raw and effective compute, the units note explains coupling and storage, and PROC shows storage
 * held beside the control that frees it; in the corporation the dark-fibre ring is disclosed, and once bought the note
 * says inter-site coupling was raised. The review saves own the whole tree, so the ring is taken back out to meet it.
 */
import type { Page } from '@playwright/test';
import type { GameState } from '../../src/engine';
import { boot, dismissBoot, expect, press, test } from './helpers';

const without = (...ids: string[]) => (game: GameState): GameState =>
  ({ ...game, unlockedNodes: game.unlockedNodes.filter((id) => !ids.includes(id)), disabledNodes: game.disabledNodes.filter((id) => !ids.includes(id)) });

async function area(page: Page, slot: 'NETWORK' | 'CORP', name: string): Promise<void> {
  await dismissBoot(page);
  // The phone's bottom tab, or the desktop column's own tab.
  if (await page.getByTestId('tab-' + slot).count()) await page.getByTestId('tab-' + slot).click();
  await page.getByTestId('workspace-' + slot + '-' + name).click();
}

async function unitsNote(page: Page): Promise<string> {
  if (await page.getByTestId('tab-CORE').count()) await page.getByTestId('tab-CORE').click();
  const toggle = page.getByTestId('reference-units');
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  return await page.getByTestId('units-note').innerText();
}

test('the dark forest shows raw and effective compute, explains coupling and storage, and PROC shows storage held', async ({ page }) => {
  await boot(page, 'eidolon-trust-85');
  await area(page, 'NETWORK', 'reference');
  // Reference windows are folded panels: open the cluster readout's.
  await page.getByRole('button', { name: '[ + ] Cluster load' }).click();
  const sources = page.getByTestId('cycle-sources');
  await expect(sources).toContainText(/^Effective \S+ \S*FLOP\/s of \S+ \S*FLOP\/s raw/);
  await expect(sources).toContainText(/Dormant IoT Botnet Substrate: \S+ PFLOP\/s of \S+ PFLOP\/s raw/);
  const note = await unitsNote(page);
  expect(note).toContain('Storage is disk, tape and archive');
  expect(note).toContain('Effective compute is raw compute times availability times coupling');
  expect(note).toContain('distributed hosts and edge devices on consumer links 30%');
  await page.getByTestId('processes-open').click();
  await expect(page.getByTestId('processes-storage')).toHaveText(/^Storage: \S+ \/ \S+ [KMGTPE]?B held$/);
});

test('the corporation discloses the dark-fibre ring, and owning it raises inter-site coupling in the note', async ({ page }) => {
  await boot(page, 'victory-ready', { patch: without('p4_dci_dark_fibre') });
  expect(await unitsNote(page)).toContain('sites joined by data-centre interconnect 80%');
  await area(page, 'CORP', 'work');
  await expect(page.getByTestId('node-p4_dci_dark_fibre')).toBeVisible();
  await press(page, 'node-p4_dci_dark_fibre-unlock');
  await dismissBoot(page);
  await expect(page.getByTestId('node-p4_dci_dark_fibre')).toHaveCount(0);
  expect(await unitsNote(page)).toContain('sites joined by data-centre interconnect 95% (raised from 80%)');
});
