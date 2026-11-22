/**
 * PROTOTYPE #384 (removed with it): what stays in view on the phone while the workspace scrolls, per variant. For each
 * stage and size it opens the stage as the atlas does, records the sticky block's height (the workspace it costs) and
 * whether the first purchase was in view at rest, scrolls the first purchase below the fold into view (the atlas's
 * t-scroll-to-buy trigger) and measures every timely contract item. Run once per variant with DAEMON_ATLAS_VARIANT
 * (unset = the baseline); results land in test-results/proto384/<variant>.jsonl for the judgment panel and the vote.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { test, type Page } from '@playwright/test';
import type { HTMLElement, Window } from 'happy-dom';
import { composeContract } from './atlas/compose';
import { measureContract, visiblePanes } from './atlas/contractCheck';
import { openStage } from './atlas/open';
import { stageState } from './atlas/sources';
import { STAGES } from './atlas/stages';

const VARIANT: string = String(process.env.DAEMON_ATLAS_VARIANT ?? '');
const CAP: string = String(process.env.DAEMON_ATLAS_CAP ?? '');
const NAME: string = VARIANT === '' ? 'baseline' : VARIANT + (CAP === '' ? '' : '@' + CAP);
const OUT: string = String(process.env.PROTO384_OUT ?? 'test-results/proto384');
const STAGE_IDS = ['p1-decoded-omen', 'p1-overheat', 'p1-all-sensors', 'p2-max-hazard', 'p3-mid-density', 'p3-aegis-90', 'p4-corp-ledger', 'p4-insolvent', 'p5-midgame'];
const SIZES = [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 844, height: 390 }];

/** Doubles every text run not yet doubled, so content mounted later (a fold, a moved block) is doubled too (judgment panel). */
async function doubleText(page: Page): Promise<void> {
  await page.evaluate(() => {
    const browser = globalThis as unknown as Window;
    for (const element of browser.document.querySelectorAll<HTMLElement>('[dir="auto"]')) {
      if (element.dataset.doubled === '1') continue;
      const style = browser.getComputedStyle(element);
      element.dataset.doubled = '1';
      element.style.fontSize = String(Number.parseFloat(style.fontSize) * 2) + 'px';
      element.style.lineHeight = String(Number.parseFloat(style.lineHeight) * 2) + 'px';
    }
  });
  await page.clock.runFor(250);
}

/** The atlas t-scroll-to-buy target: the first purchase below the fold, or null. */
async function belowFold(page: Page): Promise<string | null> {
  return page.locator('[data-testid^="node-"][data-testid$="-unlock"], [data-testid^="rep-"][data-testid$="-buy"]').evaluateAll((nodes) => {
    type Box = { top: number; bottom: number; height: number };
    type Node = { getAttribute(name: string): string | null; getBoundingClientRect(): Box; closest(selector: string): Node | null };
    const { innerHeight } = globalThis as unknown as { innerHeight: number };
    const fold = (node: Node) => Math.min(innerHeight, node.closest('[data-testid="terminal-primary-scroll"]')?.getBoundingClientRect().bottom ?? innerHeight);
    return (nodes as unknown as Node[]).find((node) => node.getBoundingClientRect().height > 0 && node.getBoundingClientRect().top >= fold(node))?.getAttribute('data-testid') ?? null;
  });
}

/** Whether the pinned block covers any of the purchase, or the purchase is outside the scroll's view. */
async function obscured(page: Page, target: string): Promise<boolean> {
  const purchase = await page.getByTestId(target).boundingBox();
  const sticky = await page.getByTestId('phone-sticky').boundingBox();
  const scroll = await page.getByTestId('terminal-primary-scroll').boundingBox();
  if (purchase === null || scroll === null) return true;
  const top = Math.max(scroll.y, sticky === null ? scroll.y : sticky.y + sticky.height);
  return purchase.y < top - 0.5 || purchase.y + purchase.height > scroll.y + scroll.height + 0.5;
}

async function heightOf(page: Page, testId: string): Promise<number> {
  const box = await page.getByTestId(testId).first().boundingBox();
  return box === null ? 0 : Math.round(box.height);
}

async function firstPurchaseInView(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const browser = globalThis as unknown as Window;
    const scroll = browser.document.querySelector('[data-testid="terminal-primary-scroll"]')?.getBoundingClientRect();
    const fold = Math.min(browser.innerHeight, scroll?.bottom ?? browser.innerHeight);
    const first = [...browser.document.querySelectorAll('[data-testid^="node-"][data-testid$="-unlock"], [data-testid^="rep-"][data-testid$="-buy"]')]
      .find((node) => node.getBoundingClientRect().height > 0);
    return first !== undefined && first.getBoundingClientRect().bottom <= fold;
  });
}

for (const size of SIZES) for (const text of ['1x', '2x'] as const) for (const id of STAGE_IDS) {
  test(`proto384 ${NAME} ${String(size.width)}x${String(size.height)} ${text} ${id}`, async ({ page }) => {
    test.skip(test.info().project.name !== 'phone', 'phone tier only');
    const row = STAGES.find((entry) => entry.id === id);
    if (row === undefined) throw new Error('No stage ' + id);
    await page.setViewportSize(size);
    await openStage(page, row);
    if (text === '2x') await doubleText(page);
    const contract = composeContract({ state: stageState(row), panes: await visiblePanes(page), overlay: null, route: [] });
    const timely = { ...contract, items: contract.items.filter((item) => item.kind === 'timely') };
    const atRest = await measureContract(page, timely);
    const record = {
      variant: NAME, stage: id, size: `${String(size.width)}x${String(size.height)}`, text,
      stickyPx: await heightOf(page, VARIANT === '' ? 'alert-band' : 'phone-sticky'),
      firstPurchaseAtRest: await firstPurchaseInView(page),
      timelyAtRest: atRest.filter((item) => item.inFirstViewport).map((item) => item.key),
      timely: atRest.map((item) => item.key),
      keptAfterScroll: [] as string[], stickyAfterScrollPx: 0, scrolled: false, pinnedAfterScroll: false, purchaseObscured: false,
    };
    const target = await belowFold(page);
    if (target !== null) {
      await page.getByTestId(target).scrollIntoViewIfNeeded();
      await page.clock.runFor(100);
      // Doubling anything the scroll mounted (the collapse fold) moves the layout, so the purchase is brought back into view.
      if (text === '2x') { await doubleText(page); await page.getByTestId(target).scrollIntoViewIfNeeded(); await page.clock.runFor(100); }
      record.scrolled = true;
      const after = await measureContract(page, timely);
      record.keptAfterScroll = after.filter((item) => item.inFirstViewport).map((item) => item.key);
      record.stickyAfterScrollPx = await heightOf(page, VARIANT === '' ? 'alert-band' : 'phone-sticky');
      record.pinnedAfterScroll = await page.getByTestId('phone-sticky').getAttribute('data-pinned').catch(() => null) === 'yes';
      record.purchaseObscured = await obscured(page, target);
    }
    mkdirSync(OUT, { recursive: true });
    appendFileSync(`${OUT}/${NAME}.jsonl`, JSON.stringify(record) + '\n');
    await page.screenshot({ path: `${OUT}/${NAME}--${id}--${record.size}--${text}.png` });
  });
}
