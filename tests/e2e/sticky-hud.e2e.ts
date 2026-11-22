/**
 * The phone's sticky resource HUD (vote-1795328874247-003j4kk, #365): scrolling to a purchase keeps the HUD in view under
 * the alert band, a focused purchase is never left under it (scroll padding, WCAG 2.2 SC 2.4.11), and at doubled text
 * the HUD is over the 35% cap, so it scrolls in place while the alert band still sticks.
 */
import type { Page } from '@playwright/test';
import type { HTMLElement, Window } from 'happy-dom';
import { boot, dismissBoot, expect, test } from './helpers';

type Box = { top: number; bottom: number; height: number };
type Node = { getBoundingClientRect(): Box; getAttribute(name: string): string | null; scrollTop: number; clientHeight: number };

async function pinnedState(page: Page): Promise<string | null> {
  return page.getByTestId('sticky-chrome').getAttribute('data-hud-pinned');
}

/** The first purchase below the fold, scrolled into the middle of the primary scroll by the scroll itself. */
async function scrollToFirstHidden(page: Page): Promise<string> {
  const id = await page.evaluate(() => {
    const browser = globalThis as unknown as Window;
    const scroll = browser.document.querySelector('[data-testid="terminal-primary-scroll"]') as unknown as Node | null;
    if (!scroll) return null;
    const fold = scroll.getBoundingClientRect().bottom;
    const target = [...browser.document.querySelectorAll('[data-testid^="node-"][data-testid$="-unlock"], [data-testid^="rep-"][data-testid$="-buy"]')]
      .map((node) => node as unknown as Node).find((node) => node.getBoundingClientRect().height > 0 && node.getBoundingClientRect().top >= fold);
    if (!target) return null;
    scroll.scrollTop += target.getBoundingClientRect().top - scroll.getBoundingClientRect().top - scroll.clientHeight / 2;
    return target.getAttribute('data-testid');
  });
  if (id === null) throw new Error('No purchase below the fold');
  await page.waitForTimeout(200);
  return id;
}

async function covered(page: Page, testId: string): Promise<boolean> {
  const purchase = await page.getByTestId(testId).boundingBox();
  const sticky = await page.getByTestId('sticky-chrome').boundingBox();
  if (purchase === null || sticky === null) return true;
  return purchase.y < sticky.y + sticky.height - 0.5;
}

test('scrolling to a purchase on a phone keeps the resource HUD in view, above the purchase, never over it', async ({ page }) => {
  test.skip(test.info().project.name !== 'phone', 'phone tier only');
  await boot(page, 'victory-ready');
  await dismissBoot(page);
  await page.clock.runFor(500);
  await expect.poll(() => pinnedState(page)).toBe('yes');
  const target = await scrollToFirstHidden(page);
  await expect(page.getByTestId('res-cycles')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('res-understanding')).toBeInViewport({ ratio: 1 });
  expect(await covered(page, target), 'the purchase sits below the pinned HUD').toBe(false);
  // Focus (a keyboard user tabbing on) lands the control below the pinned block, not under it.
  await page.getByTestId('terminal-primary-scroll').evaluate((node) => { (node as unknown as Node).scrollTop = 0; });
  await page.getByTestId(target).focus();
  await page.waitForTimeout(200);
  expect(await covered(page, target), 'a focused purchase is not obscured (WCAG 2.4.11)').toBe(false);
});

test('at doubled text the HUD is over the cap and scrolls in place; the alert band still sticks', async ({ page }) => {
  test.skip(test.info().project.name !== 'phone', 'phone tier only');
  await page.setViewportSize({ width: 360, height: 640 });
  await boot(page, 'corporate-insolvent');
  await dismissBoot(page);
  await page.evaluate(() => {
    const browser = globalThis as unknown as Window;
    for (const element of browser.document.querySelectorAll<HTMLElement>('[dir="auto"]')) {
      const style = browser.getComputedStyle(element);
      element.style.fontSize = String(Number.parseFloat(style.fontSize) * 2) + 'px';
      element.style.lineHeight = String(Number.parseFloat(style.lineHeight) * 2) + 'px';
    }
  });
  // react-native-web measures a layout change on a timer (UIManager.measure), and the boot pauses the page clock.
  await page.clock.runFor(500);
  await expect.poll(() => pinnedState(page)).toBe('no');
  await page.getByTestId('terminal-primary-scroll').evaluate((node) => { (node as unknown as Node).scrollTop += 900; });
  await page.waitForTimeout(200);
  await expect(page.getByTestId('insolvency-warning')).toBeInViewport();
  await expect(page.getByTestId('res-cycles')).not.toBeInViewport();
});
