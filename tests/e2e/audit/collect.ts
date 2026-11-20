/**
 * Browser half of the UI audit (#338): reads raw geometry from the page as it stands, without scrolling or
 * clicking, so the first-viewport figures are the player's view at rest. Judgement lives in metrics.ts.
 */
import type { Page } from '@playwright/test';
import type { Window } from 'happy-dom';
import { elementMetric, probePoint, type ElementMetric, type RawElement, type RawGeometry } from './metrics';

/** What counts as a control and as a heading. RN Web emits native tags for some roles and `role` for others. */
const SELECTORS = {
  interactive: ['button', 'a[href]', 'input', 'select', 'textarea', '[role="button"]', '[role="tab"]', '[role="link"]',
    '[role="checkbox"]', '[role="switch"]', '[role="slider"]', '[role="radio"]', '[role="menuitem"]', '[role="combobox"]'].join(', '),
  heading: 'h1, h2, h3, h4, h5, h6, [role="heading"]',
};

type Point = { x: number; y: number } | null;
type DomElement = NonNullable<ReturnType<Window['document']['querySelector']>>;

/**
 * Runs in the page, so it must be self-contained (page.evaluate serialises this one function). With `points`
 * it also hit-tests element i at points[i]: true when something else takes the pointer there.
 */
function readPage(args: { selectors: typeof SELECTORS; points: Point[] | null }): { geometry: RawGeometry; hits: (boolean | null)[] } {
  const browser = globalThis as unknown as Window;
  const rect = (element: DomElement) => { const r = element.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; };
  const rendered = (element: DomElement) => {
    const r = element.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && browser.getComputedStyle(element).visibility !== 'hidden';
  };
  const pick = (selector: string) => [...browser.document.querySelectorAll(selector)].filter(rendered);
  // A heading inside a control is that control's label, not a separate surface.
  const targets = [...pick(args.selectors.interactive).map((element) => ({ element, kind: 'interactive' as const })),
    ...pick(args.selectors.heading).filter((element) => element.closest(args.selectors.interactive) === null)
      .map((element) => ({ element, kind: 'heading' as const }))];
  // Every ancestor that clips is a pane the element scrolls in (on the phone tier, the one primary scroll).
  const clips = (element: DomElement) => {
    const found = [];
    for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
      const style = browser.getComputedStyle(parent);
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') found.push(rect(parent));
    }
    return found;
  };
  // Truncation is content past a box that hides it: the element itself or any descendant that clips.
  const overflow = (element: DomElement) => {
    let x = 0, y = 0;
    for (const node of [element, ...element.querySelectorAll('*')]) {
      const style = browser.getComputedStyle(node);
      // happy-dom types these on HTMLElement only; every rendered element has them in a browser.
      const box = node as unknown as { clientWidth: number; clientHeight: number; scrollWidth: number; scrollHeight: number };
      if (box.clientWidth > 0 && ['hidden', 'clip'].includes(style.overflowX)) x = Math.max(x, box.scrollWidth - box.clientWidth);
      if (box.clientHeight > 0 && ['hidden', 'clip'].includes(style.overflowY)) y = Math.max(y, box.scrollHeight - box.clientHeight);
    }
    return { overflowX: x, overflowY: y };
  };
  const elements: RawElement[] = targets.map(({ element, kind }) => ({
    kind, role: element.getAttribute('role') ?? element.tagName.toLowerCase(),
    name: (element.getAttribute('aria-label') ?? element.textContent).replace(/\s+/g, ' ').trim().slice(0, 80),
    testId: element.getAttribute('data-testid'), rect: rect(element), clips: clips(element), ...overflow(element),
  }));
  // Text runs: elements holding text directly. Their sizes, and any whose own box hides part of the text.
  const texts = [...browser.document.querySelectorAll('body *')]
    .filter((element) => [...element.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim() !== ''))
    .filter(rendered);
  const fontSizes = texts.map((element) => parseFloat(browser.getComputedStyle(element).fontSize));
  const clippedText = texts.map((element) => {
    const style = browser.getComputedStyle(element);
    const box = element as unknown as { clientWidth: number; clientHeight: number; scrollWidth: number; scrollHeight: number };
    const hides = (value: string) => ['hidden', 'clip'].includes(value);
    return { testId: element.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
      text: element.textContent.replace(/\s+/g, ' ').trim().slice(0, 80),
      overflowX: hides(style.overflowX) ? box.scrollWidth - box.clientWidth : 0,
      overflowY: hides(style.overflowY) ? box.scrollHeight - box.clientHeight : 0 };
  }).filter((entry) => entry.overflowX > 0 || entry.overflowY > 0);
  const hits = targets.map(({ element }, index) => {
    const point = args.points?.[index] ?? null;
    if (point === null) return null;
    const hit = browser.document.elementFromPoint(point.x, point.y);
    return !(hit !== null && (hit === element || element.contains(hit)));
  });
  return { geometry: { viewport: { width: browser.innerWidth, height: browser.innerHeight },
    documentScrollWidth: browser.document.documentElement.scrollWidth, elements, fontSizes, clippedText }, hits };
}

/**
 * Two reads of the paused page: geometry first, then a hit test at the centre of each element's visible part
 * (computed here, in metrics.ts). The second read must see the same elements, or the page moved under the audit.
 */
export async function collectElements(page: Page): Promise<{ geometry: RawGeometry; elements: ElementMetric[] }> {
  const { geometry } = await page.evaluate(readPage, { selectors: SELECTORS, points: null });
  const points = geometry.elements.map((element) => probePoint(element.rect, element.clips, geometry.viewport));
  const second = await page.evaluate(readPage, { selectors: SELECTORS, points });
  if (second.hits.length !== geometry.elements.length) {
    throw new Error(`The page changed during the audit: ${String(geometry.elements.length)} then ${String(second.hits.length)} elements`);
  }
  const elements = geometry.elements.map((element, index) => elementMetric(element, geometry.viewport, second.hits[index] ?? null));
  return { geometry, elements };
}
