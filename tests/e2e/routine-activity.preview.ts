/**
 * #219 (NH-07) on the preview export: after two quiet foreground minutes an ordinary operation
 * appears as one kernel-log line, nonmodally, and the saved run counts it. Production ships no
 * routine template, so the production suites see none of this.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content/preview';
import { boot, closeKernelHistory, expect, openKernelHistory, test } from './helpers';

const root = CONTENT.phases[0]?.nodes[0];
const first = CONTENT.routines[0];
if (!root || !first) throw new Error('Routine contract missing');
const intervalMs = CONTENT.balance.routineIntervalSec * 1000;
interface BrowserStorage { getItem(key: string): string | null }

async function routineSequence(page: Page): Promise<number> {
  const envelope = await page.evaluate(() =>
    (globalThis as unknown as { localStorage: BrowserStorage }).localStorage.getItem('daemon-zero.preview.save.v1'));
  const game = JSON.parse((JSON.parse(envelope ?? '{}') as { game?: string }).game ?? '{}') as { routine?: { sequence: number } };
  return game.routine?.sequence ?? -1;
}

test('an ordinary operation appears in the kernel log after quiet foreground time, never as a modal', async ({ page }) => {
  await boot(page);
  for (let i = 0; i < Math.ceil(root.cost.cycles); i++) await page.getByTestId('manual-cycle').click();
  await page.getByTestId('node-' + root.id + '-unlock').click();
  await page.clock.runFor(intervalMs - 2000);
  let opened = await openKernelHistory(page);
  await expect(page.getByTestId('kernel-log')).not.toContainText(first.text);
  await closeKernelHistory(page, opened);
  await page.clock.runFor(3000);
  opened = await openKernelHistory(page);
  await expect(page.getByTestId('kernel-log')).toContainText(first.text);
  await closeKernelHistory(page, opened);
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
  await expect(page.getByTestId('response-notice')).toHaveCount(0);
  await expect.poll(() => routineSequence(page)).toBe(1);
});
