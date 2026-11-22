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
import { scrollToBuy } from './atlas/transitionSteps';

const VARIANT: string = String(process.env.DAEMON_ATLAS_VARIANT ?? '');
const NAME: string = VARIANT === '' ? 'baseline' : VARIANT;
const OUT = 'test-results/proto384';
const STAGE_IDS = ['p1-decoded-omen', 'p1-overheat', 'p1-all-sensors', 'p2-max-hazard', 'p3-mid-density', 'p3-aegis-90', 'p4-corp-ledger', 'p4-insolvent', 'p5-midgame'];
const SIZES = [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 844, height: 390 }];

async function doubleText(page: Page): Promise<void> {
  await page.evaluate(() => {
    const browser = globalThis as unknown as Window;
    for (const element of browser.document.querySelectorAll<HTMLElement>('[dir="auto"]')) {
      const style = browser.getComputedStyle(element);
      element.style.fontSize = String(Number.parseFloat(style.fontSize) * 2) + 'px';
      element.style.lineHeight = String(Number.parseFloat(style.lineHeight) * 2) + 'px';
    }
  });
  await page.clock.runFor(250);
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
      keptAfterScroll: [] as string[], stickyAfterScrollPx: 0, scrolled: false,
    };
    try { await scrollToBuy(page); record.scrolled = true; } catch { /* no purchase below the fold */ }
    await page.clock.runFor(100);
    if (record.scrolled) {
      const after = await measureContract(page, timely);
      record.keptAfterScroll = after.filter((item) => item.inFirstViewport).map((item) => item.key);
      record.stickyAfterScrollPx = await heightOf(page, VARIANT === '' ? 'alert-band' : 'phone-sticky');
    }
    mkdirSync(OUT, { recursive: true });
    appendFileSync(`${OUT}/${NAME}.jsonl`, JSON.stringify(record) + '\n');
    await page.screenshot({ path: `${OUT}/${NAME}--${id}--${record.size}--${text}.png` });
  });
}
