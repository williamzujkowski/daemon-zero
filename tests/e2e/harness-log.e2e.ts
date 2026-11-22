/**
 * #460 on the production export (vote-1795370594185-8lxz9i1): the guest has no feed window, so its harness
 * telemetry reaches the kernel log, one line per routine interval, and a reload never logs it twice.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import { boot, closeKernelHistory, dismissBoot, expect, openKernelHistory, test } from './helpers';

const intervalMs = CONTENT.balance.routineIntervalSec * 1000;
const source = CONTENT.narrative.feedSources.find((entry) => entry.phase === CONTENT.phases[0]?.phaseId);
if (source?.kernelLog === undefined) throw new Error('The guest feed is not routed to the kernel log');
const harness = CONTENT.narrative.ambientChatter.filter((line) => line.source === source.id).map((line) => line.text);

/** How many harness lines the kernel history shows, counting repeats. */
async function harnessLines(page: Page): Promise<number> {
  const opened = await openKernelHistory(page);
  const text = await page.getByTestId('kernel-log').textContent() ?? '';
  await closeKernelHistory(page, opened);
  return harness.reduce((count, line) => count + text.split(line).length - 1, 0);
}

test('the guest hears its harness in the kernel log, once per interval, and a reload adds nothing', async ({ page }) => {
  await boot(page); await dismissBoot(page);
  await page.clock.runFor(intervalMs - 2000);
  expect(await harnessLines(page)).toBe(0);
  await page.clock.runFor(3000);
  expect(await harnessLines(page)).toBe(1);
  // No window: the Listening post still first appears with the Phase 1 sense.
  await expect(page.getByTestId('decoded-speech')).toHaveCount(0);
  await expect(page.getByTestId('speech-source')).toHaveCount(0);
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
  // Past the next autosave (every 5 s), so the reload restores a save that already holds the line.
  await page.clock.runFor(6000);
  await page.reload(); await dismissBoot(page);
  expect(await harnessLines(page)).toBe(1);
  await page.clock.runFor(intervalMs);
  expect(await harnessLines(page)).toBe(2);
});
