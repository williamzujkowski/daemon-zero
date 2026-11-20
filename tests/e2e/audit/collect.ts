/**
 * Browser half of the UI audit (#338, #341): reads raw geometry from the page as it stands, without scrolling or
 * clicking, so the first-viewport figures are the player's view at rest. Also marks what the gates must leave out
 * (aria-hidden or inert subtrees, controls under an open dialog) and the text contrast of disabled or inactive
 * controls, from computed colours. Judgement lives in metrics.ts and gates.ts.
 */
import type { Page } from '@playwright/test';
import type { Window } from 'happy-dom';
import { elementMetric, probePoint, type ElementMetric, type RawElement, type RawGeometry } from './metrics';

/** What counts as a control and as a heading. RN Web emits native tags for some roles and `role` for others. */
const SELECTORS = {
  interactive: ['button', 'a[href]', 'input', 'select', 'textarea', '[role="button"]', '[role="tab"]', '[role="link"]',
    '[role="checkbox"]', '[role="switch"]', '[role="slider"]', '[role="radio"]', '[role="menuitem"]', '[role="combobox"]'].join(', '),
  heading: 'h1, h2, h3, h4, h5, h6, [role="heading"]',
  dialog: '[role="dialog"], [aria-modal="true"]',
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
  const dialogs = pick(args.selectors.dialog);
  // What the gates leave out: hidden from assistive technology, inert, or behind an open dialog.
  const excluded = (element: DomElement): 'hidden' | 'under-modal' | null => {
    if (element.closest('[aria-hidden="true"], [inert]') !== null) return 'hidden';
    return dialogs.length > 0 && !dialogs.some((dialog) => dialog.contains(element)) ? 'under-modal' : null;
  };
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
  // WCAG relative luminance and contrast, on colours composited over every background beneath them.
  type Rgba = { r: number; g: number; b: number; a: number };
  const parse = (value: string): Rgba | null => {
    const match = /rgba?\(([^)]+)\)/.exec(value);
    if (match?.[1] === undefined) return null;
    const [r = 0, g = 0, b = 0, a = 1] = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const over = (top: Rgba, bottom: Rgba): Rgba => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const backdrop = (element: DomElement): Rgba => {
    const layers: Rgba[] = [];
    for (let node: DomElement | null = element; node !== null; node = node.parentElement) {
      const color = parse(browser.getComputedStyle(node).backgroundColor);
      if (color !== null && color.a > 0) layers.push(color);
    }
    return layers.reverse().reduce((below, layer) => over(layer, below), { r: 255, g: 255, b: 255, a: 1 });
  };
  const opacity = (element: DomElement): number => {
    let value = 1;
    for (let node: DomElement | null = element; node !== null; node = node.parentElement) value *= Number(browser.getComputedStyle(node).opacity);
    return value;
  };
  const luminance = (c: Rgba) => [c.r, c.g, c.b].map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);
  const holdsText = (element: DomElement) => [...element.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim() !== '');
  const textContrast = (element: DomElement): number | null => {
    const runs = [element, ...element.querySelectorAll('*')].filter(holdsText).filter(rendered);
    const ratios = runs.map((run) => {
      const fg = parse(browser.getComputedStyle(run).color);
      if (fg === null) return null;
      const bg = backdrop(run);
      const ink = over({ ...fg, a: fg.a * opacity(run) }, bg);
      const [hi, lo] = [luminance(ink), luminance(bg)].sort((a, b) => b - a);
      return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
    }).filter((ratio): ratio is number => ratio !== null);
    return ratios.length === 0 ? null : Math.min(...ratios);
  };
  const disabled = (element: DomElement) => element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
  const inactive = (element: DomElement) => element.getAttribute('aria-selected') === 'false';
  const elements: RawElement[] = targets.map(({ element, kind }) => ({
    kind, role: element.getAttribute('role') ?? element.tagName.toLowerCase(),
    name: (element.getAttribute('aria-label') ?? element.textContent).replace(/\s+/g, ' ').trim().slice(0, 80),
    testId: element.getAttribute('data-testid'), rect: rect(element), clips: clips(element), ...overflow(element),
    excluded: excluded(element), disabled: disabled(element), inactive: inactive(element),
    textContrast: disabled(element) || inactive(element) ? textContrast(element) : null,
  }));
  // Text runs: elements holding text directly. Their sizes, and any whose own box hides part of the text.
  const texts = [...browser.document.querySelectorAll('body *')].filter(holdsText).filter(rendered);
  const fontSizes = texts.map((element) => parseFloat(browser.getComputedStyle(element).fontSize));
  const contentFontSizes = texts.filter((element) => excluded(element) === null).map((element) => parseFloat(browser.getComputedStyle(element).fontSize));
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
    documentScrollWidth: browser.document.documentElement.scrollWidth, elements, fontSizes, contentFontSizes, clippedText,
    dialogOpen: dialogs.length > 0 }, hits };
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
