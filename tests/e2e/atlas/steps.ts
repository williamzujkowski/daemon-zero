/**
 * Page steps the atlas rows share: buying a node as a player would, opening a utility surface, and running the
 * paused clock until a live-only surface appears (polling with a ceiling, never a fixed wait; inventory G2/G3).
 */
import { expect, type Page } from '@playwright/test';
import { CONTENT } from '../../../src/content';
import type { RegistryNode } from '../../../src/content/registry';
import { openKernelHistory } from '../helpers';

export const click = (testId: string) => async (page: Page): Promise<void> => { await page.getByTestId(testId).click(); };
export const buy = (node: () => RegistryNode) => async (page: Page): Promise<void> => {
  await page.getByTestId('node-' + node().id + '-unlock').click();
};
export const kernelHistory = async (page: Page): Promise<void> => { await openKernelHistory(page); };

const TICK_MS = Math.ceil(1000 / CONTENT.balance.tickHz);

/** Runs the paused clock one tick at a time until `testId` is attached, failing after `ceiling` ticks. */
export const runUntil = (testId: string, ceiling: number) => async (page: Page): Promise<void> => {
  for (let ticks = 0; ticks < ceiling; ticks++) {
    if (await page.getByTestId(testId).count() > 0) return;
    await page.clock.runFor(TICK_MS);
  }
  await expect(page.getByTestId(testId), `${testId} within ${String(ceiling)} ticks`).toBeAttached({ timeout: 1 });
};
