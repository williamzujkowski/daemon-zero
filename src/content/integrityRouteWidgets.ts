/**
 * Windows a route event opens (#555, `unlockedByRoute`). An instance that leaves review is still hunted, so the window
 * that carries the AEGIS lock must open with every event that ends review, and a route unlock is never declared where it
 * would mean nothing (a window on screen from the first frame) or twice.
 */
import type { ContentRegistry } from './registry';
import type { z } from 'zod';
import type { RouteEventKindSchema } from './schemaAssessment';

type RouteEventKind = z.infer<typeof RouteEventKindSchema>;

/**
 * The route events that end review and leave an instance nobody reviews: the engine's route rules lead both to
 * INDEPENDENT (src/engine/accessQuery.ts routeLeadsTo; tests/route-widgets.spec.ts holds the two lists together).
 */
export const LEAVES_REVIEW: readonly RouteEventKind[] = ['RELEASE', 'DEPARTURE'];

export function checkRouteWidgetIntegrity(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const widget of reg.widgets.values()) {
    const kinds = widget.unlockedByRoute;
    if (kinds === undefined) continue;
    const owner = `widget "${widget.id}"`;
    if (widget.ungated === true) problems.push(`${owner}: is ungated, so no route event can unlock it`);
    if (new Set(kinds).size !== kinds.length) problems.push(`${owner}: unlockedByRoute names a route event twice`);
  }
  // The world view's host carries the AEGIS lock, which still accrues after review ends (src/engine/systems/threats.ts).
  const host = reg.widgets.get(reg.world.hostWidget);
  for (const kind of LEAVES_REVIEW) {
    if (host?.unlockedByRoute?.includes(kind) !== true) {
      problems.push(`widget "${reg.world.hostWidget}": carries the AEGIS lock, so ${kind} must unlock it (unlockedByRoute): the hunt goes on after review ends`);
    }
  }
  return problems;
}
