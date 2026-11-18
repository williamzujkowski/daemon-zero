/**
 * The heading outline a screen reader's heading navigation walks (#302), read from the DOM the browser exposes:
 * every heading in document order with its level, and for each widget panel and node card on screen, the
 * heading that titles it. Shared by the original-route audit and the route semantics spec.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';

export interface OutlineEntry { level: number; text: string }
export interface TitledSurface { kind: 'widget' | 'node'; id: string; title: string; level: number | null; text: string; inWidget: boolean }
export interface Outline { headings: OutlineEntry[]; surfaces: TitledSurface[] }

interface Element {
  getAttribute(name: string): string | null; tagName: string; textContent: string | null;
  closest(selector: string): Element | null; querySelector(selector: string): Element | null;
  matches(selector: string): boolean; querySelectorAll(selector: string): Iterable<Element>;
}
interface BrowserDocument { querySelectorAll(selector: string): Iterable<Element> }

/** A widget title is a section heading under the page title; a card inside a widget is one level below it. */
export const WIDGET_TITLE_LEVEL = 2;
export const CARD_LEVEL = { pane: 2, widget: 3 } as const;

export function expectedLevel(surface: TitledSurface): number {
  if (surface.kind === 'widget') return WIDGET_TITLE_LEVEL;
  return surface.inWidget ? CARD_LEVEL.widget : CARD_LEVEL.pane;
}

export async function readOutline(page: Page): Promise<Outline> {
  const widgets = [...CONTENT.widgets.values()].map((widget) => [widget.id, widget.title] as const);
  const nodes = [...CONTENT.nodes.keys()];
  return page.evaluate(({ widgets: widgetList, nodes: nodeList }) => {
    const { document } = globalThis as unknown as { document: BrowserDocument };
    const HEADING = '[role="heading"], h1, h2, h3, h4, h5, h6';
    const levelOf = (element: Element): number | null => {
      if (!element.matches(HEADING)) return null;
      const aria = element.getAttribute('aria-level');
      if (aria !== null) return Number(aria);
      return /^H[1-6]$/.test(element.tagName) ? Number(element.tagName.slice(1)) : null;
    };
    const text = (element: Element | null): string => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const headings = [...document.querySelectorAll(HEADING)].map((element) => ({ level: levelOf(element) ?? 0, text: text(element) }));
    const surfaces: TitledSurface[] = [];
    for (const [id, title] of widgetList) {
      for (const panel of document.querySelectorAll('[data-testid="widget-' + id + '"]')) {
        // The guest console pins a widget compact, without its title (TerminalPane).
        if (panel.closest('[data-testid="guest-console"]') !== null) continue;
        const heading = panel.querySelector(HEADING);
        surfaces.push({ kind: 'widget', id, title, level: heading === null ? null : levelOf(heading), text: text(heading), inWidget: false });
      }
    }
    for (const id of nodeList) {
      for (const card of document.querySelectorAll('[data-testid="node-' + id + '"]')) {
        const title = card.querySelector('[data-testid="node-' + id + '-title"]');
        if (title === null) continue;
        // The accessible name, not the drawn text: a title being revealed is drawn scrambled for a moment.
        surfaces.push({ kind: 'node', id, title: title.getAttribute('aria-label') ?? text(title), level: levelOf(title), text: text(title),
          inWidget: card.closest('[data-testid^="widget-"]') !== null });
      }
    }
    return { headings, surfaces };
  }, { widgets, nodes });
}

/**
 * What heading navigation would miss or misread: a widget or card title that is not a heading, or sits at the
 * wrong level, and a heading that jumps more than one level below the one before it (axe's heading-order).
 */
export function outlineProblems({ headings, surfaces }: Outline): string[] {
  const problems: string[] = [];
  if (!headings.some((heading) => heading.level === 1)) problems.push('no level-1 heading');
  headings.forEach((heading, index) => {
    const previous = headings[index - 1];
    if (heading.level < 1) problems.push('"' + heading.text + '": heading without a level');
    if (previous !== undefined && heading.level > previous.level + 1) {
      problems.push('"' + heading.text + '": level ' + String(heading.level) + ' after level ' + String(previous.level));
    }
  });
  for (const surface of surfaces) {
    const name = surface.kind + '-' + surface.id;
    const expected = expectedLevel(surface);
    if (surface.level === null) problems.push(name + ': title "' + surface.title + '" is not a heading');
    else if (surface.level !== expected) problems.push(name + ': title at level ' + String(surface.level) + ', expected ' + String(expected));
    if (surface.kind === 'widget' && !surface.text.includes(surface.title)) problems.push(name + ': first heading "' + surface.text + '" is not its title');
  }
  return problems;
}
