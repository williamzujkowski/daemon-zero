/**
 * Width policy for the terminal: which layout a viewport gets, and the budgets
 * that keep a line of prose readable at any width (#89, #103 measured gaps 4-6).
 *
 * Pure and total: every width/height pair maps to one mode, so the layout can be
 * unit-tested without a browser and the E2E size matrix only has to confirm the
 * geometry the policy predicts.
 */

/** Below this a single primary scroll and its tab bar are the whole layout. */
export const MOBILE_MAX_WIDTH = 767;

/** From here the column layout starts; the old single 900 boundary left 768-899
 *  as a dead zone of phone layout on tablet-width glass (#103 gap 4). */
export const COLUMN_MIN_WIDTH = 768;

/** From here the third column earns its space; below it the panel is two columns. */
export const THREE_COLUMN_MIN_WIDTH = 900;

/** A short viewport keeps the single scroll even when it is wide: height, not
 *  width, is what a landscape phone lacks, and that is the separate #103 gap 1. */
export const SHORT_VIEWPORT_MAX_HEIGHT = 599;

/** Narrowest the supporting column may be before the core column gives way
 *  (#103 gap 5: it was 225-300px, roughly 200-260px of content). */
export const SIDE_COLUMN_MIN_WIDTH = 340;

/** Widest a reading column may be. 14px monospace advances ~8.4px per character,
 *  so 760px holds about 87 characters — inside the 45-90 suggestion, whereas the
 *  uncapped 1659px card at 2560 held nearly 200 (#103 gap 6). */
export const CONTENT_MAX_WIDTH = 760;

export type LayoutMode = 'mobile' | 'tablet' | 'desktop';

/**
 * Caption compaction boundary: below the three-column tier the core column is at
 * most two thirds of the viewport, so costs and resources abbreviate. Kept here
 * so the four components that need it read one number instead of four copies of
 * `width < 900` (docs/UI-SIZES.md, Limits).
 */
export function isCompactViewport(width: number): boolean {
  return width < THREE_COLUMN_MIN_WIDTH;
}

export interface TerminalLayout {
  readonly mode: LayoutMode;
  /** True only in the desktop tier, where the third column has room to exist. */
  readonly threeColumns: boolean;
  /** Floor the supporting column keeps by shrinking the core column instead. */
  readonly sideMinWidth: number;
  /** Cap applied to the content inside a pane, so cards stay at a readable measure. */
  readonly contentMaxWidth: number;
}

/**
 * Resolve the layout for a viewport. Width decides the tier; a short viewport is
 * held at the single-scroll layout because the column tiers assume vertical room
 * the height slice (#103 gaps 1-3) is what will address.
 */
export function layoutFor(width: number, height = Number.POSITIVE_INFINITY): TerminalLayout {
  // An unmeasured height (0, or a window that has not laid out yet) is not
  // evidence of a short viewport; only a real, positive height below the floor is.
  const short = height > 0 && height <= SHORT_VIEWPORT_MAX_HEIGHT;
  if (width < COLUMN_MIN_WIDTH || short) {
    return { mode: 'mobile', threeColumns: false, sideMinWidth: 0, contentMaxWidth: CONTENT_MAX_WIDTH };
  }
  return {
    mode: width < THREE_COLUMN_MIN_WIDTH ? 'tablet' : 'desktop',
    threeColumns: width >= THREE_COLUMN_MIN_WIDTH,
    sideMinWidth: SIDE_COLUMN_MIN_WIDTH,
    contentMaxWidth: CONTENT_MAX_WIDTH,
  };
}