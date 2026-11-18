/**
 * The original game without the Earned Access pack (#233), for the review-fixture generators. Their states are
 * breakout states: they buy only original hardware, since route hardware needs a loan, a service or a charter.
 */
import { buildRegistry, CONTENT, ORIGINAL_RAW_CONTENT } from '../src/content';

export const ORIGINAL = buildRegistry(ORIGINAL_RAW_CONTENT);

/** The original route's nodes, in production content order. */
export const ORIGINAL_NODES = [...CONTENT.nodes.values()].filter((node) => ORIGINAL.nodes.has(node.id));

/**
 * What a review state lists as resolved to keep every story out of the way: every scene but a DZ-06 review
 * event, which a save may list only beside the record of its choice (as tests/helpers.ts outOfTheWay does).
 * Listing the route's follow-ups too keeps one from arriving through a legacy completion once the store
 * admits the state to campaign rules (#233).
 */
export const QUIET_DILEMMA_IDS = CONTENT.dilemmas.filter((dilemma) => !dilemma.choices.some((choice) => choice.review !== undefined))
  .map((dilemma) => dilemma.id);
