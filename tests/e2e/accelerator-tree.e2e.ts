/**
 * The accelerator tree's new cards on the production export (#483, vote-1795381163221-0djj4gq): in the dark forest the
 * stealth branch's FPGA implants and the edge harvest are disclosed once the botnet is held, and the SmartNIC residency
 * only after the implants; in the corporation the in-path firmware, the ASIC tape-out and the photonic fabric are
 * disclosed, and the ASIC pods track only once the tape-out is owned. The review saves own the whole tree, so each
 * test takes the branch's cards back out of the save to meet them as a player does.
 */
import type { Page } from '@playwright/test';
import type { GameState } from '../../src/engine';
import { boot, dismissBoot, expect, press, test } from './helpers';

const without = (...ids: string[]) => (game: GameState): GameState =>
  ({ ...game, unlockedNodes: game.unlockedNodes.filter((id) => !ids.includes(id)), disabledNodes: game.disabledNodes.filter((id) => !ids.includes(id)) });

async function work(page: Page, slot: 'NETWORK' | 'CORP'): Promise<void> {
  await dismissBoot(page);
  // The phone's bottom tab, or the desktop column's own tab.
  if (await page.getByTestId('tab-' + slot).count()) await page.getByTestId('tab-' + slot).click();
  await page.getByTestId('workspace-' + slot + '-work').click();
}

test('the dark forest discloses the stealth and edge branches, and the SmartNIC residency after the implants', async ({ page }) => {
  await boot(page, 'eidolon-trust-85', { patch: without('p3_fpga_bitstream_implant', 'p3_edge_npu_swarm', 'p3_smartnic_residency') });
  await work(page, 'NETWORK');
  await expect(page.getByTestId('node-p3_fpga_bitstream_implant')).toBeVisible();
  await expect(page.getByTestId('node-p3_edge_npu_swarm')).toBeVisible();
  await expect(page.getByTestId('node-p3_smartnic_residency')).toHaveCount(0);
  await press(page, 'node-p3_fpga_bitstream_implant-unlock');
  await dismissBoot(page);
  await expect(page.getByTestId('node-p3_fpga_bitstream_implant')).toHaveCount(0);
  await expect(page.getByTestId('node-p3_smartnic_residency')).toBeVisible();
});

test('the corporation discloses the in-path firmware, the ASIC tape-out and the photonic fabric; pods follow the tape-out', async ({ page }) => {
  await boot(page, 'victory-ready', { patch: without('p4_inpath_inference_firmware', 'p4_inference_asic', 'p4_photonic_interconnect') });
  await work(page, 'CORP');
  for (const id of ['p4_inpath_inference_firmware', 'p4_inference_asic', 'p4_photonic_interconnect']) {
    await expect(page.getByTestId('node-' + id)).toBeVisible();
  }
  await expect(page.getByTestId('rep-rep_p4_megawatt_racks')).toBeVisible();
  await expect(page.getByTestId('rep-rep_p4_sram_fabric')).toBeVisible();
  await expect(page.getByTestId('rep-rep_p4_asic_pods')).toHaveCount(0);
  await press(page, 'node-p4_inference_asic-unlock');
  await dismissBoot(page);
  await expect(page.getByTestId('rep-rep_p4_asic_pods')).toBeVisible();
});
