/**
 * NH-05 (#217) in the production export. Both start states are FIXTURES built through public engine
 * actions on the production registry (tests/obligation-helpers.ts, tests/minds-helpers.ts), imported
 * through the save screen, not naturally reached play:
 * - iteration 2 of a campaign whose four Phase 5 obligations were answered in iteration 1, with the
 *   final protocol's prerequisites owned again: the real purchase ends the run, the ending survives
 *   a reload, and the current run never resolved a Phase 5 crisis;
 * - iteration 2 after the atmospheric crisis closed unobserved: its recovery review is on screen and
 *   the free honest handoff completes it through the modal.
 */
import type { Page } from '@playwright/test';
import { exportSave } from '../../src/engine';
import { activeGame } from '../campaign-helpers';
import { caught, ticks, untilPresented } from '../interruption-helpers';
import { next, omen, own, play } from '../minds-helpers';
import { ATMOSPHERE, ATMOSPHERE_REVIEW, BLOCKADE, CEILING, finalNode, OBLIGATIONS, ORDER } from '../obligation-helpers';
import { boot, dismissBoot, expect, openSave, test, press } from './helpers';

const SAVE_KEY = 'daemon-zero.save.v1';
interface BrowserStorage { getItem(key: string): string | null }

async function storedSave(page: Page): Promise<{ ending: string | null; iteration: number; resolvedDilemmas: string[]; campaign: { events: Record<string, { status: string; outcome?: string }> } }> {
  const text = await page.evaluate((key) => (globalThis as unknown as { localStorage: BrowserStorage }).localStorage.getItem(key), SAVE_KEY);
  return JSON.parse((JSON.parse(text ?? '{}') as { game: string }).game) as Awaited<ReturnType<typeof storedSave>>;
}

async function importCode(page: Page, code: string): Promise<void> {
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(code);
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
}

/** FIXTURE: four obligations answered in iteration 1, then a voluntary wipe and the final prerequisites owned again. */
function completedBeforeWipe(): string {
  let s = play(activeGame(), BLOCKADE, 'proofs', [ORDER, ATMOSPHERE, CEILING]);
  s = play(s, ORDER, 'hold_for_inventory', [ATMOSPHERE, CEILING]);
  s = play(s, ATMOSPHERE, 'burn', [CEILING]);
  s = play(s, CEILING, 'quartz');
  return exportSave(own(next(s), ...finalNode().prerequisites));
}

/** FIXTURE: the atmospheric crisis wiped during its omen, then its recovery review presented in iteration 2. */
function reviewOnScreen(): string {
  const lost = caught(ticks(omen(activeGame(), ATMOSPHERE, [CEILING]), 5));
  return exportSave(untilPresented(omen(lost, ATMOSPHERE_REVIEW, [CEILING])));
}

test('a later instance finishes the campaign through obligations its predecessor completed', async ({ page }) => {
  await importCode(page, completedBeforeWipe());
  await dismissBoot(page);
  const final = finalNode();
  if (await page.getByTestId('tab-CORP').count()) await page.getByTestId('tab-CORP').click();
  await page.getByTestId('workspace-CORP-work').click();
  await press(page, 'node-' + final.id + '-unlock');
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  await expect(page.getByTestId('ending-title')).toHaveText('The Verified Covenant');
  const ended = await storedSave(page);
  expect(ended.ending).toBe('VERIFIED_COVENANT');
  expect(ended.iteration).toBe(2);
  expect(ended.resolvedDilemmas.filter((id) => OBLIGATIONS.includes(id))).toEqual([]);
  await page.reload();
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  expect((await storedSave(page)).ending).toBe('VERIFIED_COVENANT');
});

test('a closed crisis is answered through its recovery review, with no outcome invented for the original', async ({ page }) => {
  await importCode(page, reviewOnScreen());
  // A later iteration's import shows the restored-checkpoint sequence over the modal first.
  await dismissBoot(page);
  const modal = page.getByTestId('dilemma-modal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Review');
  await expect(modal).toContainText('contact was lost before it decided');
  await expect(page.getByTestId('dilemma-choice-commission_assay')).toBeVisible();
  await page.getByTestId('dilemma-choice-hand_to_health_authorities').click();
  await expect(modal).toHaveCount(0);
  await expect.poll(async () => (await storedSave(page)).campaign.events[ATMOSPHERE_REVIEW]?.status).toBe('resolved');
  const saved = await storedSave(page);
  expect(saved.campaign.events[ATMOSPHERE]).toMatchObject({ status: 'interrupted' });
  expect(saved.campaign.events[ATMOSPHERE]?.outcome).toBeUndefined();
});
