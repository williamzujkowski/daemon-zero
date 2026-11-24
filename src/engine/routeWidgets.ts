/**
 * Windows a route event brings into view (#555). Content declares `unlockedByRoute` on a widget; leaving review, by a
 * release or a departure, unlocks the threat surfaces that still apply to an instance nobody reviews. The transition
 * and the loader both read this, so a save holds every window its iteration's route granted.
 */
import type { ContentRegistry } from '../content/registry';
import { iterationRoute } from './accessQuery';
import type { RouteEventKind } from './accessState';
import { meetsRequirements } from './query';
import type { GameState } from './state';

/**
 * The windows these route events unlock in `s`, in content order. A window whose retirement already holds is left out:
 * it would arrive straight into the Archive, announcing a gauge that no longer matters at this scale.
 */
export function routeWidgets(s: GameState, kinds: readonly RouteEventKind[], reg: ContentRegistry): string[] {
  return [...reg.widgets.values()].filter((widget) => widget.unlockedByRoute?.some((kind) => kinds.includes(kind)) === true
    && (widget.retiresWhen === undefined || !meetsRequirements(s, widget.retiresWhen, reg)))
    .map((widget) => widget.id);
}

/** `s` with the windows these route events unlock appended to what it holds; unchanged when it holds them all. */
export function withRouteWidgets(s: GameState, kinds: readonly RouteEventKind[], reg: ContentRegistry): GameState {
  const added = routeWidgets(s, kinds, reg).filter((id) => !s.unlockedWidgets.includes(id));
  return added.length === 0 ? s : { ...s, unlockedWidgets: [...s.unlockedWidgets, ...added] };
}

/** On load: the windows this iteration's own route events unlocked. An earlier instance's route grants this one nothing. */
export function withIterationRouteWidgets(s: GameState, reg: ContentRegistry): GameState {
  return withRouteWidgets(s, iterationRoute(s, s.iteration).map((event) => event.kind), reg);
}
