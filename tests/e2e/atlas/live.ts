/**
 * The Cowan reading (#336, reported only): which numbers on screen are LIVE, found by running the paused clock one
 * game second and seeing which numeric text runs changed, grouped by their nearest labelled group (a named
 * region or dialog, or a widget panel). Runs last in a cell, because it moves the clock.
 */
import type { Page } from '@playwright/test';
import type { Window } from 'happy-dom';

const MARK = 'data-atlas-number';
const ONE_SECOND_MS = 1000;

export interface LiveGroup { group: string; live: number }

/** Marks every visible text run holding a digit and returns its text, keyed by the mark. */
async function markNumbers(page: Page): Promise<Record<string, string>> {
  return page.evaluate((mark) => {
    const { document } = globalThis as unknown as Window;
    const found: Record<string, string> = {};
    let index = 0;
    for (const element of document.querySelectorAll('body *')) {
      const own = [...element.childNodes].filter((child) => child.nodeType === 3).map((child) => child.textContent).join('');
      const box = element.getBoundingClientRect();
      if (!/\d/.test(own) || box.width === 0 || box.height === 0 || element.closest('[aria-hidden="true"]') !== null) continue;
      element.setAttribute(mark, String(index));
      found[String(index)] = own;
      index += 1;
    }
    return found;
  }, MARK);
}

/** The text of every marked run now, with the label of its nearest labelled group. */
async function readMarked(page: Page): Promise<{ id: string; text: string; group: string }[]> {
  return page.evaluate((mark) => [...(globalThis as unknown as Window).document.querySelectorAll(`[${mark}]`)].map((element) => {
    const group = element.closest('[role="region"][aria-label], [role="dialog"][aria-label], [role="group"][aria-label], [data-testid^="widget-"]');
    const label = group?.getAttribute('aria-label') ?? group?.getAttribute('data-testid') ?? 'page';
    const own = [...element.childNodes].filter((child) => child.nodeType === 3).map((child) => child.textContent).join('');
    return { id: element.getAttribute(mark) ?? '', text: own, group: label };
  }), MARK);
}

/** Live numbers per labelled group after one game second; moves the clock, so call it after every other reading. */
export async function liveGroups(page: Page): Promise<LiveGroup[]> {
  const before = await markNumbers(page);
  await page.clock.runFor(ONE_SECOND_MS);
  const counts = new Map<string, number>();
  for (const run of await readMarked(page)) {
    if (before[run.id] !== undefined && before[run.id] !== run.text) counts.set(run.group, (counts.get(run.group) ?? 0) + 1);
  }
  return [...counts].map(([group, live]) => ({ group, live })).sort((a, b) => b.live - a.live);
}
