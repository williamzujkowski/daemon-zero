/**
 * Routes from a warning to the control its remedy names (#369): a remedy that says "in PAYROLL" can take the player there.
 * A request is a plain event, not state: whichever parts are mounted act on it (the phone tab bar and the tablet or
 * desktop side column select the pane, the workspace selects and focuses its area tab, PROC opens its dialog), so a
 * route can never leave a stale selection behind.
 */
import { useEffect, useRef } from 'react';
import type { WorkspaceArea } from './workspaceTypes';

export type RouteTarget = { kind: 'area'; slot: string; area: WorkspaceArea } | { kind: 'proc' };

/** The remedy words a route answers to, and where each goes. */
export const ROUTE_WORDS: Readonly<Record<string, RouteTarget>> = {
  PAYROLL: { kind: 'area', slot: 'CORP', area: 'payroll' },
  FINANCE: { kind: 'area', slot: 'CORP', area: 'finance' },
  PROC: { kind: 'proc' },
};

type Listener = (target: RouteTarget) => void;
const listeners = new Set<Listener>();
/** An area route waits here until its pane mounts: on a phone the CORP pane exists only once its tab is selected. */
let pending: Extract<RouteTarget, { kind: 'area' }> | null = null;

export function requestRoute(target: RouteTarget): void {
  pending = target.kind === 'area' ? target : null;
  for (const listener of [...listeners]) listener(target);
}

/** The area route waiting for `slot`'s workspace, taken once; null when none waits. */
export function takeAreaRoute(slot: string | undefined): WorkspaceArea | null {
  if (pending === null || pending.slot !== slot) return null;
  const { area } = pending;
  pending = null;
  return area;
}

/** Calls `handler` for every route request while mounted; the latest handler is used, so it may close over state. */
export function useRouteRequests(handler: Listener): void {
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  useEffect(() => {
    const listener: Listener = (target) => { latest.current(target); };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
}
