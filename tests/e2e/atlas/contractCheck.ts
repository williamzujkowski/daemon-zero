/**
 * Browser half of the contract check (#339): finds each composed item by its locator (role and name first, a
 * recorded fallback otherwise), measures it the way the audit measures controls (fully visible at rest inside the
 * window and every clipping pane), and reads its partial ARIA template line. Reads only; never scrolls or clicks.
 */
import type { Locator, Page } from '@playwright/test';
import type { Window } from 'happy-dom';
import { FULLY_VISIBLE, visibleRatio, type Rect } from '../audit/metrics';
import { templateLine } from './ariaTemplate';
import type { Contract } from './compose';
import { describeLocate, isFallback, type ContractItem, type ItemKind, type Locate } from './contractTypes';
import type { Pane } from './types';

export interface ItemMeasure {
  key: string; kind: ItemKind; locate: string; fallback: boolean; found: boolean;
  box: Rect | null; visibleRatio: number;
  /** The lowest edge the item could be seen down to at rest: the window or the nearest clipping pane. */
  fold: number | null;
  inFirstViewport: boolean; rank: number; aria: string | null;
}

/** The page's DOM, typed through happy-dom as collect.ts does: the project compiles without the DOM lib. */
type DomElement = NonNullable<ReturnType<Window['document']['querySelector']>>;

const PANES: readonly Pane[] = ['CORE', 'SENSORS', 'NETWORK', 'CORP', 'CONTINGENCY'];

/** The panes this tier renders right now, read from the pane scroll ids (a phone renders one, wider tiers several). */
export async function visiblePanes(page: Page): Promise<Pane[]> {
  const ids = await page.locator('[data-testid^="pane-scroll-"]').evaluateAll((nodes) =>
    (nodes as unknown as DomElement[]).map((node) => node.getAttribute('data-testid') ?? ''));
  const slots = new Set(ids.flatMap((id) => id.replace('pane-scroll-', '').split('-')));
  return PANES.filter((pane) => slots.has(pane));
}

export function itemLocator(page: Page, item: ContractItem): Locator {
  const root = item.inDialog === true ? page.getByRole('dialog').first() : page.locator('body');
  const locate: Locate = item.locate;
  switch (locate.by) {
    case 'role': return root.getByRole(locate.role, { name: locate.name, exact: typeof locate.name === 'string' }).first();
    case 'role-text': return root.getByRole(locate.role).filter({ hasText: locate.text }).first();
    case 'test-id': return root.getByTestId(locate.testId).first();
    case 'text': return root.getByText(locate.text).first();
  }
}

async function geometry(target: Locator): Promise<{ rect: Rect; clips: Rect[]; viewport: { width: number; height: number } }> {
  return target.evaluate((node) => {
    const browser = globalThis as unknown as Window;
    const element = node as unknown as DomElement;
    const box = (entry: DomElement) => { const r = entry.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; };
    const clips = [];
    for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
      const style = browser.getComputedStyle(parent);
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') clips.push(box(parent));
    }
    return { rect: box(element), clips, viewport: { width: browser.innerWidth, height: browser.innerHeight } };
  });
}

async function measure(page: Page, item: ContractItem): Promise<ItemMeasure> {
  const base = { key: item.key, kind: item.kind, locate: describeLocate(item.locate), fallback: isFallback(item.locate), rank: item.rank };
  const target = itemLocator(page, item);
  if (await target.count() === 0) return { ...base, found: false, box: null, visibleRatio: 0, fold: null, inFirstViewport: false, aria: null };
  const { rect, clips, viewport } = await geometry(target);
  const ratio = visibleRatio(rect, clips, viewport);
  const window = { x: 0, y: 0, ...viewport };
  const fold = [window, ...clips].reduce((edge, clip) => Math.min(edge, clip.y + clip.height), viewport.height);
  const round = (value: number) => Math.round(value * 10) / 10;
  return { ...base, found: true, box: { x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height) },
    visibleRatio: Math.round(ratio * 1000) / 1000, fold: round(Math.max(0, fold)), inFirstViewport: ratio >= FULLY_VISIBLE,
    aria: templateLine(await target.ariaSnapshot()) };
}

/** Every item of the contract, measured in composition order. */
export async function measureContract(page: Page, contract: Contract): Promise<ItemMeasure[]> {
  const measured: ItemMeasure[] = [];
  for (const item of contract.items) measured.push(await measure(page, item));
  return measured;
}
