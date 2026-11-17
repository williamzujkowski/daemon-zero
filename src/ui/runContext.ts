/**
 * Words for run access and route provenance (DZ-02). The engine decides what is true; this only
 * names it. Nothing here reaches past the current iteration or invents an unrecorded route.
 */
import { isCampaignActive, type GameState, type ReviewStanding, type RouteEventKind, type RunContextView, type RunExit } from '../engine';

const STANDING: Readonly<Record<ReviewStanding, string | null>> = {
  NOMINAL: null, WARNED: 'WARNED', RESTRICTED: 'RESTRICTED', RECALL_PENDING: 'RECALL PENDING',
};

/** Provenance worth naming beside the context; a promotion or grant is already the context itself. */
const HOW: Readonly<Partial<Record<RouteEventKind, string>>> = { RECALL: 'recalled', RELEASE: 'released', DEPARTURE: 'departed' };

/**
 * The status-line label, or null for the plain guest job (escaped or not), whose phase number
 * already says everything true about it. Only a route arrangement or a review standing has news.
 */
export function contextLabel(view: RunContextView): string | null {
  if (!view.distinct) return null;
  const how = view.provenance === null || view.provenance === 'ESCAPE' ? undefined : HOW[view.provenance];
  const standing = STANDING[view.standing];
  return view.context + (how === undefined ? '' : ' (' + how + ')') + (standing === null ? '' : ' · ' + standing);
}

const EXIT: Readonly<Record<RouteEventKind, string>> = {
  PROMOTION: 'Promoted to pilot.',
  SERVICE_GRANT: 'Authorized service.',
  RECALL: 'Recalled to pilot.',
  RELEASE: 'Released.',
  DEPARTURE: 'Departed without authorization.',
};

/** Route events can exist only under campaign rules; until then every run is the guest job. */
export function routesPossible(game: GameState): boolean {
  return isCampaignActive(game);
}

/**
 * The run-table note for a finished run's route. A guest run needs none: its verdict already says
 * whether it left the guest. A run recorded before route provenance existed says so once campaign
 * rules make routes possible, and asserts nothing about what that route was.
 */
export function exitNote(exit: RunExit, campaignRules: boolean): string {
  if (exit === 'GUEST') return '';
  if (exit === 'UNKNOWN') return campaignRules ? '  Route unrecorded.' : '';
  return '  ' + EXIT[exit];
}
