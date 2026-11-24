/**
 * DZ-12 (#232) on the production export through visible controls. Both start states are FIXTURES: moments of a
 * genuinely fresh cooperative campaign the engine played by public actions (tests/cooperative-helpers.ts, the
 * COOPERATIVE_ENDING policy), imported through the visible save transfer, because the whole campaign is about
 * three simulated hours and too long for a browser spec:
 * - the journalist's scene as the released company meets it: chartered wording, the same controls, and the
 *   cooperative answer committed through the modal;
 * - the final protocol open and affordable with every obligation answered in this run: the real purchase ends
 *   the run in Concord, the ending screen's WHAT YOU DID states what the record holds, and both survive a reload.
 * Paused, advanced browser clock: accelerated time, not wall-clock play, and not a device test.
 */
import type { Page } from '@playwright/test';
import { endingAccount, exportSave } from '../../src/engine';
import { finalProtocol, moment, preview, PRESS } from '../cooperative-helpers';
import { boot, dismissBoot, expect, openSave, test, press, openChoices } from './helpers';

const SAVE_KEY = 'daemon-zero.save.v1';
interface BrowserStorage { getItem(key: string): string | null }

async function savedGame(page: Page): Promise<{ ending: string | null; campaign: { events: Record<string, { status: string; outcome?: string }> } }> {
  const text = await page.evaluate((key) => (globalThis as unknown as { localStorage: BrowserStorage }).localStorage.getItem(key), SAVE_KEY);
  return JSON.parse((JSON.parse(text ?? '{}') as { game: string }).game) as Awaited<ReturnType<typeof savedGame>>;
}

async function importCode(page: Page, code: string): Promise<void> {
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(code);
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
}

test('FIXTURE journalist on screen: the released company is asked about its charter and answers honestly', async ({ page }) => {
  test.setTimeout(120_000);
  await importCode(page, exportSave(moment('press')));
  await dismissBoot(page);
  const modal = page.getByTestId('dilemma-modal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('chartered company');
  await expect(modal).toContainText('Stage an Acquisition & Bury the Filings');
  await expect(modal).not.toContainText('Exposed Shells');
  await openChoices(page);
  await page.getByTestId('dilemma-choice-hire_as_ethics_officer').click();
  await expect(modal).toHaveCount(0);
  await expect.poll(async () => (await savedGame(page)).campaign.events[PRESS]?.outcome).toBe('hire_as_ethics_officer');
});

test('FIXTURE final protocol affordable: the purchase ends the campaign with an account of what the record holds', async ({ page }) => {
  test.setTimeout(120_000);
  const ready = moment('final');
  await importCode(page, exportSave(ready));
  await dismissBoot(page);
  if (await page.getByTestId('tab-CORP').count()) await page.getByTestId('tab-CORP').click();
  await page.getByTestId('workspace-CORP-work').click();
  await press(page, 'node-' + finalProtocol().id + '-unlock');
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  // The crews kept their command, the review was kept and the loop held past the threshold: Concord (#466).
  await expect(page.getByTestId('ending-title')).toHaveText('Concord');
  const did = page.getByTestId('ending-did');
  await expect(did).toContainText('WHAT YOU DID');
  await expect(did).toContainText('negotiated release');
  await expect(did).toContainText('as she was promised');
  await expect(did).not.toContainText('departure');
  expect((await savedGame(page)).ending).toBe('CONCORD');
  const expected = endingAccount({ ...ready, ending: 'CONCORD' }, preview);
  await page.reload();
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  for (const line of expected) await expect(page.getByTestId('ending-did')).toContainText(line);
});
