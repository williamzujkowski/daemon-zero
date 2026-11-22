/** Large text must leave real decisions reachable, not merely avoid horizontal overflow. */
import type { Locator, Page } from '@playwright/test';
import type { HTMLElement, Window } from 'happy-dom';
import { CONTENT } from '../../src/content';
import { openSave, test, expect, boot, dismissBoot, readSave, openKernelHistory, closeKernelHistory } from './helpers';
import { AEGIS_ROLES, cappedPayroll } from './payrollState';

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
  const tier = await openKernelHistory(page);
  await expect(page.getByTestId(tier === 'band' ? 'kernel-history' : 'menu-kernel-log')).toBeVisible();
  await closeKernelHistory(page, tier);
  if (tier === 'band') await expect(page.getByTestId('kernel-size-toggle')).toBeFocused();
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

test('200% text keeps the payroll totals, the AEGIS cap note and a hire reachable (#210)', async ({ page }) => {
  const strongest = AEGIS_ROLES[0];
  if (!strongest) throw new Error('Missing AEGIS role');
  await boot(page, 'victory-ready', { patch: cappedPayroll }); await openArea(page, 'CORP', 'payroll');
  await doubleText(page);
  for (const id of ['payroll-totals', 'payroll-aegis', 'payroll-suspicion-floor', 'rep-' + strongest.id + '-aegis-capped']) {
    const line = page.getByTestId(id);
    await line.scrollIntoViewIfNeeded();
    await expect(line).toBeInViewport();
  }
  await expect(page.getByTestId('payroll-aegis')).toContainText('More AEGIS levels add nothing.');
  await reachable(page.getByTestId('rep-' + strongest.id + '-buy'));
  await noHorizontalScroll(page);
});

test('200% text keeps the world view readable and an AEGIS countermeasure reachable (#463)', async ({ page }) => {
  const action = [...CONTENT.actions.values()].find((entry) => entry.group === 'ai_aegis_watchdog');
  if (!action) throw new Error('Missing AEGIS countermeasure');
  await boot(page, 'victory-ready', { patch: (game) => ({ ...game, aegisAdaptation: 80 }) }); await openArea(page, 'NETWORK', 'minds');
  await doubleText(page);
  const actor = CONTENT.world.stateActors[0]?.id ?? '';
  for (const id of ['aegis-adaptation', 'aegis-stage', 'aegis-why', 'aegis-cap', 'aegis-strike', 'public-trust', 'public-trust-coalition', 'actor-' + actor + '-posture']) {
    const line = page.getByTestId(id);
    await line.scrollIntoViewIfNeeded();
    await expect(line).toBeInViewport();
  }
  await reachable(page.getByTestId('action-' + action.id));
  await noHorizontalScroll(page);
});
