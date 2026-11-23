/**
 * Window retirement on the production export (vote-1795366695204-4nslts1, #447): a Phase 4 save shows no retired
 * window in the tabs or CORE, lists each under the Archive heading in NETWORK > REFERENCE, says nothing about them on
 * load, and says the next retirement (the redundancy meter, once orbital storage makes retention total) exactly once,
 * politely, without moving focus; a reload says nothing again.
 */
import type { Page } from '@playwright/test';
import { boot, core, dismissBoot, expect, press, readSave, test } from './helpers';
import { installObserver, readObserver } from './atlas/announce';
import { axeReport } from './axe';

const RETIRED = ['MANUAL_CYCLE_CONTROL', 'QUOTA_SKIM_CONTROL', 'ASCII_OPTICAL_VIEWPORT', 'GLOBAL_DARK_FOREST_MAP', 'THERMAL_AND_SUSPICION_BARS'];
const ORBIT = 'node-p4_orbital_cold_storage-unlock';
const RETIREMENT = 'Retired to the Archive';

async function openArchive(page: Page): Promise<void> {
  // The phone's bottom tab, or the desktop third column's own NETWORK tab.
  await page.getByTestId('tab-NETWORK').click();
  await page.getByTestId('workspace-NETWORK-reference').click();
}

test('a Phase 4 save keeps retired windows out of the panes, readable in the Archive, announced once', async ({ page }) => {
  await boot(page, 'victory-ready', { axeTimers: true });
  await dismissBoot(page);
  // Load is a baseline: the windows the save already retired are not announced.
  await expect(page.getByTestId('announcer')).not.toContainText(RETIREMENT);

  await core(page);
  await expect(page.getByTestId('manual-cycle')).toHaveCount(0);
  await expect(page.getByTestId('widget-QUOTA_SKIM_CONTROL')).toHaveCount(0);
  await expect(page.getByTestId('widget-ASCII_OPTICAL_VIEWPORT')).toHaveCount(0);
  await expect(page.getByTestId('widget-GLOBAL_DARK_FOREST_MAP')).toHaveCount(0);
  // The sensors that still matter keep their tab (phone) or column (desktop); the camera is not among them. The thermal
  // gauge retires at Phase 4 with its strip readout (docs/SCALE.md rule 7), and the fan dial keeps a panel of its own.
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  await expect(page.getByTestId('widget-FAN_RPM_SLIDER')).toBeVisible();
  await expect(page.getByTestId('fan-increase')).toBeVisible();
  await expect(page.getByTestId('widget-THERMAL_AND_SUSPICION_BARS')).toHaveCount(0);
  await expect(page.getByTestId('thermal-meter')).toHaveCount(0);
  await expect(page.getByTestId('widget-ASCII_OPTICAL_VIEWPORT')).toHaveCount(0);

  await openArchive(page);
  await expect(page.getByRole('heading', { name: 'Archive', level: 2 })).toBeVisible();
  for (const id of RETIRED) await expect(page.getByTestId('archive-' + id)).toBeVisible();
  for (const id of RETIRED) await page.getByTestId('reference-archive-' + id).click();
  await expect(page.getByTestId('reference-archive-QUOTA_SKIM_CONTROL')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('skim-archived')).toContainText('fixed at its last setting');
  await expect(page.getByTestId('skim-increase')).toHaveCount(0);
  await expect(page.getByTestId('manual-cycle-archived')).toContainText('Net rate now:');
  await expect(page.getByTestId('thermal-archived')).toContainText('heat is no longer evidence; power is the limit.');
  // The open Archive is held to the same axe rules as every other surface.
  const audit = await axeReport(page);
  expect(audit.nativeTimers).toBe(true);
  expect(audit.violations).toEqual([]);

  await page.getByTestId('tab-CORP').click();
  await page.getByTestId('workspace-CORP-work').click();
  await installObserver(page);
  await press(page, ORBIT);
  await dismissBoot(page);
  const observed = await readObserver(page);
  const said = observed.announcements.filter((entry) => entry.kind === 'live' && entry.text.includes(RETIREMENT));
  expect(said).toHaveLength(1);
  expect(said[0]?.testId).toBe('announcer');
  expect(said[0]?.live).toBe('polite');
  const text = said[0]?.text ?? '';
  expect(text.split(RETIREMENT)).toHaveLength(2);
  expect(text).toContain('Redundancy meter');
  // No retirement moves focus into a dialog or onto the Archive.
  expect(observed.focusInDialog).toBe(false);
  const saved = await readSave(page) as { logs: { text: string }[] };
  expect(saved.logs.filter((entry) => entry.text.startsWith('ARCHIVED // ') && entry.text.includes('Redundancy meter'))).toHaveLength(1);

  await page.reload();
  await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  await dismissBoot(page);
  await expect(page.getByTestId('announcer')).not.toContainText(RETIREMENT);
  await openArchive(page);
  for (const id of [...RETIRED, 'GLOBAL_NODE_REDUNDANCY_METER']) await expect(page.getByTestId('archive-' + id)).toBeVisible();
  const reloaded = await readSave(page) as { logs: { text: string }[] };
  expect(reloaded.logs.filter((entry) => entry.text.startsWith('ARCHIVED // '))).toHaveLength(saved.logs.filter((entry) => entry.text.startsWith('ARCHIVED // ')).length);
});
