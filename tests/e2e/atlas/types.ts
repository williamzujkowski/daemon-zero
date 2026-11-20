/**
 * The stage atlas's row type (#341, from the stage inventory's section 5 sketch): one row is one screen a player
 * meets, named by where its save comes from, any page step that makes a live-only overlay appear, and the
 * pane and test id that prove the cell reached it. Every source resolves to a GameState, so one loader opens all.
 */
import type { Page } from '@playwright/test';
import type { GameState } from '../../../src/engine';
import type { WorkspaceArea } from '../../../src/ui/workspaceTypes';
import type { CampaignMoment } from './campaignSaves';

export type StageSource =
  /** A `makeFixtures()` save, as `boot()` loads it (scripts/make-fixtures.ts). */
  | { kind: 'fixture'; name: string }
  /** A careful-campaign moment under campaign rules, captured by condition (campaignSaves.ts, gaps G0 and G1). */
  | { kind: 'campaign'; name: CampaignMoment }
  /** A `ROUTE_STATES` entry by name (tests/e2e/routeStates.ts). */
  | { kind: 'route'; name: string }
  /** A moment of the fresh cooperative campaign (tests/cooperative-helpers.ts). */
  | { kind: 'moment'; name: string }
  /** A gap recipe from the inventory, built here and labelled FIXTURE in the gallery. */
  | { kind: 'build'; build: () => GameState; recipe: string };

export type StageTag =
  | 'opening' | 'omen' | 'modal' | 'threshold' | 'reveal' | 'reboot-restored' | 'reboot-live' | 'ending' | 'confirm'
  | 'menu' | 'proc' | 'hazard' | 'alert' | 'insolvent' | 'shortfall' | 'brownout' | 'overheat' | 'aegis' | 'wild'
  | 'surveillance-unknown' | 'density' | 'route' | 'patched' | 'live';

export type Pane = 'CORE' | 'SENSORS' | 'NETWORK' | 'CORP' | 'CONTINGENCY';
export type Access = 'GUEST' | 'PILOT' | 'SERVICE' | 'INDEPENDENT';
export type ExtraViewport = '320x568' | '844x390' | '900x640' | '768x1024' | '1080x800' | '1920x1080';

/**
 * What the row adds on top of the contract its save composes (contract.ts): only context the save cannot
 * tell, such as an overlay a page step opened, which pane a phone shows, or a surface the route shows.
 */
export interface StageOverrides {
  /** An overlay the prepare step opens (menu, PROC, confirm, threshold, reveal, live notice or reboot). */
  overlay?: OverlayId;
  /** Earned Access surfaces this stage shows (route context). */
  route?: readonly RouteSurface[];
}

export type RouteSurface = 'assignment' | 'review' | 'recall' | 'service-grant' | 'segment' | 'channel' | 'release' | 'departure';

export type OverlayId =
  | 'menu' | 'menu-log' | 'proc' | 'confirm-wipe' | 'threshold' | 'lineage-reveal' | 'response-notice' | 'reboot';

export interface StageRow {
  /** kebab-case, unique; also the gallery anchor and the evidence file stem. */
  id: string;
  phase: 0 | 1 | 2 | 3 | 4 | 5;
  access: Access;
  source: StageSource;
  /** Same contract as boot({ patch }): a fixture-only input, still through serialize and normal hydration. */
  patch?: (game: GameState) => GameState;
  tags: readonly StageTag[];
  /** The tab to open after load on the tiers that have tabs; defaults to the phase's own landing tab. */
  pane?: Pane;
  area?: WorkspaceArea;
  /** `keep` audits the restore/reboot screen itself; `pass` (default) continues past it. */
  reboot?: 'keep' | 'pass';
  prepare?: (page: Page) => Promise<void>;
  /** A test id that must be attached before auditing. */
  reach: string;
  /** The ending the loaded save must hold (G9: a patch or prepare step could select a different one). */
  ending?: string;
  overrides?: StageOverrides;
  extraViewports?: readonly ExtraViewport[];
  phoneOnly?: boolean;
  /** One line for the gallery: what this stage is for. */
  why: string;
}

/** kebab-case: lower-case letters and digits in words joined by single hyphens. */
export function isStageId(id: string): boolean {
  return /^[a-z0-9-]+$/.test(id) && !id.startsWith('-') && !id.endsWith('-') && !id.includes('--');
}
