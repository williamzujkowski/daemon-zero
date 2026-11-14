/** Large text must leave real decisions reachable, not merely avoid horizontal overflow. */
import type { Locator, Page } from '@playwright/test';
import type { HTMLElement, Window } from 'happy-dom';
import { CONTENT } from '../../src/content';
import { openSave, test, expect, boot, dismissBoot, readSave } from './helpers';

async function doubleText(page: Page): Promise<void> {
  // Controlled text-only stress; this is deliberately not labelled browser/native zoom.
  await page.evaluate(() => {
    const browser = globalThis as unknown as Window;
    const rows = [...browser.document.querySelectorAll<HTMLElement>('[dir="auto"]')]
      .filter((element) => !element.dataset.originalFont)
      .map((element) => ({ element, font: Number.parseFloat(browser.getComputedStyle(element).fontSize),
        line: Number.parseFloat(browser.getComputedStyle(element).lineHeight) }));
    for (const { element, font, line } of rows) {
      element.dataset.originalFont = String(font);
      element.style.fontSize = String(font * 2) + 'px';
      element.style.lineHeight = String(line * 2) + 'px';
    }
  });
  await page.clock.runFor(250);
}

async function reachable(control: Locator): Promise<void> {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeInViewport();
  await control.click({ trial: true });
  const box = await control.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
}

async function openArea(page: Page, slot: string, area: string): Promise<void> {
  await dismissBoot(page);
  if (await page.getByTestId('tab-' + slot).count()) await page.getByTestId('tab-' + slot).click();
  await page.getByTestId('workspace-' + slot + '-' + area).click();
}

async function noHorizontalScroll(page: Page): Promise<void> {
  expect(await page.evaluate(() => {
    const browser = globalThis as unknown as Window;
    return browser.document.documentElement.scrollWidth <= browser.innerWidth + 1;
  })).toBe(true);
}

test('200% text preserves an Operations purchase plus save, log and navigation access', async ({ page }) => {
  const action = [...CONTENT.actions.values()].find((entry) => entry.maxPurchases === 3);
  if (!action) throw new Error('Missing capped action');
  await boot(page, 'epistemic-ready-p2'); await openArea(page, 'NETWORK', 'operations');
  await doubleText(page);
  const pane = page.getByTestId('pane-scroll-NETWORK');
  expect((await pane.boundingBox())?.height).toBeGreaterThan(44);
  const details = page.getByTestId('details-action-' + action.id);
  await reachable(details); await details.focus(); await page.keyboard.press('Enter');
  await expect(details).toBeFocused(); await expect(details).toHaveAttribute('aria-expanded', 'true');
  await doubleText(page);
  await expect(page.getByTestId('details-body-action-' + action.id)).toContainText(action.description);
  const before = await readSave(page);
  const buy = page.getByTestId('action-' + action.id);
  await reachable(buy); await buy.click();
  const after = await readSave(page), counts = after.actionCounts as Record<string, number>;
  expect(counts[action.id]).toBe(1);
  expect(Number(after.memoryCap)).toBe(Number(before.memoryCap) + action.effects.memoryCapIncrease);
  await reachable(page.getByTestId('menu-open')); await openSave(page);
  await page.getByTestId('save-close').click();
  await reachable(page.getByTestId('kernel-size-toggle')); await page.getByTestId('kernel-size-toggle').click();
  await expect(page.getByTestId('kernel-history')).toBeVisible();
  await reachable(page.getByTestId('kernel-close')); await page.getByTestId('kernel-close').click();
  await expect(page.getByTestId('kernel-size-toggle')).toBeFocused();
  await reachable(page.getByTestId('workspace-NETWORK-work')); await page.getByTestId('workspace-NETWORK-work').click();
  await expect(page.getByTestId('workspace-NETWORK-work')).toHaveAttribute('aria-selected', 'true');
  await noHorizontalScroll(page);
});

test('200% text keeps Swarm commands and resource readouts reachable', async ({ page }) => {
  await boot(page, 'shard-drift-quirk-p4'); await openArea(page, 'CORP', 'swarm');
  await doubleText(page);
  const state = await readSave(page), shards = state.activeShards as Record<string, { drift: number }>;
  const id = Object.keys(shards)[0];
  if (!id) throw new Error('Missing cohort');
  expect((await page.getByTestId('pane-scroll-CORP').boundingBox())?.height).toBeGreaterThan(44);
  // A large heading must retain a useful reading width instead of being squeezed beside Details.
  expect((await page.getByTestId('details-title-shard-quirk-' + id).boundingBox())?.width).toBeGreaterThanOrEqual(150);
  const prune = page.getByTestId('shard-' + id + '-prune');
  await reachable(prune); await prune.focus(); await page.keyboard.press('Enter');
  await expect(page.getByTestId('shard-drift-' + id)).toContainText('0%');
  await page.getByTestId('res-cycles').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('res-cycles')).toBeInViewport();
  await expect(page.getByTestId('res-cycles')).not.toBeEmpty();
  await reachable(page.getByTestId('workspace-CORP-work')); await page.getByTestId('workspace-CORP-work').click();
  if (await page.getByTestId('terminal-tabs-scroll').count()) {
    const core = page.getByTestId('tab-CORE');
    await expect(core).not.toBeInViewport();
    await core.focus(); await expect(core).toBeFocused();
    await expect(core).toBeInViewport(); await page.keyboard.press('Enter');
    await expect(core).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('pane-scroll-CORE')).toBeVisible();
    await page.getByTestId('tab-CORP').click();
    await expect(page.getByTestId('tab-CORP')).toHaveAttribute('aria-selected', 'true');
  }
  await noHorizontalScroll(page);
});

test('short landscape keeps corporate warnings and purchases available without reducing text', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await boot(page, 'corporate-insolvent'); await openArea(page, 'CORP', 'work');
  await doubleText(page);
  await page.getByTestId('insolvency-warning').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('insolvency-warning')).toBeInViewport();
  await expect(page.getByTestId('insolvency-warning')).toContainText('INSOLVENT');
  const details = page.locator('[data-testid^="details-rep-"]').first();
  await reachable(details); await details.click();
  await expect(details).toHaveAttribute('aria-expanded', 'true');
  await reachable(page.getByTestId('workspace-CORP-finance')); await page.getByTestId('workspace-CORP-finance').click();
  await page.getByTestId('power-ledger').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('power-ledger')).toBeInViewport();
  await noHorizontalScroll(page);
});
