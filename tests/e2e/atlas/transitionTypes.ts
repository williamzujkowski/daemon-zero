/**
 * The transitions table's row type (#339, wayfinder #341): a before-state that REFERENCES a stage row of the atlas,
 * a trigger that is a real UI action or a step of the paused
 * clock, and the after expectations by check: C1 (the new element is in view and announced), C2 (a stage's timely
 * set stays in the main view) and B5 (the primary action does not move).
 */
import type { Page } from '@playwright/test';
import type { GameState } from '../../../src/engine';
import type { ContractItem } from './contractTypes';

export type TransitionCheck = 'C1' | 'C2' | 'B5';

/**
   * A stage row by id, opened as the atlas opens it. `patch` is a labelled recipe for the state one engine step
   * earlier; `prepare: 'skip'` leaves out the row's page step (the trigger is that step); `reach` replaces the row's
   * reach id when the before-frame does not show it yet.
   */
export interface TransitionBefore { stage: string; patch?: { recipe: string; apply: (game: GameState) => GameState }; prepare?: 'skip'; reach?: string }

export type Trigger =
  /** A real click on one control: its centre is the pointer the C2.9 check reads. */
  | { kind: 'click'; testId: string }
  /** A sequence of real UI actions (tabs, scrolls, menus, choices, presses). */
  | { kind: 'ui'; label: string; run: (page: Page) => Promise<void> }
  /**
   * The paused clock, one tick at a time, until `until` holds (at most `ceiling` ticks). `lead` is how many ticks the
   * engine says can pass first in one step, so a long wait stays cheap and the before-frame stays one tick earlier.
   */
  | { kind: 'clock'; label: string; until: (page: Page) => Promise<boolean>; ceiling: number; lead?: (game: GameState) => number };

/** C1: what appears, and what must say so. */
export interface AppearExpectation {
  /** The contract item (contract.ts) or a transition-local item that the trigger brings in. */
  item: (game: GameState) => ContractItem;
  /** Live text or a dialog name that counts as announcing it; omitted when only the view (or a badge) is checked. */
  announce?: RegExp;
  /** C1.10: the live regions this condition may use: at most one, with a role that matches its politeness. */
  alerts?: RegExp;
  /** Focus must land on an element (not the page body) after the trigger. */
  focus?: true;
}

/** C2: what must still be in the main view after the trigger. */
export interface KeepExpectation {
  /** The stage whose composed timely set must stay in view; defaults to the before stage. */
  stage?: string;
  /** Compose that stage without its overlay: the trigger dismissed it (a reboot screen, a confirm). */
  withoutOverlay?: true;
  /** Further item keys of that stage's contract that must be fully in view (a dilemma's first choice). */
  alsoInView?: readonly string[];
  /** EXECUTE_CLOCK_CYCLE must still be fully in view. */
  primary?: true;
  /** The first work card's title in the shown pane must be fully in view. */
  firstCard?: true;
  /** The control under the trigger's pointer must not be replaced by a different enabled control. */
  pointer?: true;
}

export interface TransitionRow {
  /** kebab-case, unique; also the gallery anchor stem, so it must not collide with a stage id. */
  id: string;
  /** Where in the disclosure walk's "Transitions the atlas should check" this row answers. */
  walk: readonly string[];
  before: TransitionBefore;
  /** Real UI actions that reach the exact before-frame (a tab, a scroll, a purchase that schedules the event). */
  setup?: (page: Page) => Promise<void>;
  trigger: Trigger;
  appear?: AppearExpectation;
  keep?: KeepExpectation;
  /** B5: the primary action's displacement is gated, not only reported. */
  steady?: true;
  why: string;
}

export const checksOf = (row: TransitionRow): TransitionCheck[] => [
  ...(row.appear === undefined ? [] : ['C1' as const]), ...(row.keep === undefined ? [] : ['C2' as const]), ...(row.steady ? ['B5' as const] : []),
];
