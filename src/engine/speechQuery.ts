/**
 * Read-only authored text chosen from world history: decoded speech from the source the AI's reach
 * hears, where recorded consequences never join the timed ambient rotation, the omen, context and
 * choices a dilemma is presented with, the aisle camera and a node's blind description.
 */
import type { ContentRegistry } from '../content/registry';
import type { Dilemma, DilemmaChoice, FeedSource, Requirements, TechNode } from '../content/schema';
import type { GameState } from './state';
import { meetsRequirements } from './query';
import { dilemmaRouteCopy } from './routeCopy';

/**
 * What the feed listens to at this reach (#449): the source authored for the furthest phase not beyond the
 * current one. Integrity gives every phase exactly one, so in shipped content it is the current phase's own.
 */
export function ambientFeedSource(s: GameState, reg: ContentRegistry): FeedSource | null {
  return reg.narrative.feedSources.reduce<FeedSource | null>((best, source) =>
    source.phase <= s.currentPhase && (best === null || source.phase > best.phase) ? source : best, null);
}

type AmbientLine = ContentRegistry['narrative']['ambientChatter'][number];

/** The source's lines this state makes true, in authored order. */
function heardLines(s: GameState, reg: ContentRegistry, source: FeedSource): AmbientLine[] {
  return reg.narrative.ambientChatter.filter((line) => line.source === source.id
    && line.minSuspicion <= s.suspicion && meetsRequirements(s, line.requirements, reg));
}

/**
 * The decoded lines that may play now, in authored order: only the current reach's source, so an outgrown
 * source (the server room in Phase 5) falls silent, and only lines whose gate the state makes true. A source
 * routed to the kernel log is never on the decoder.
 */
export function eligibleAmbientSpeech(s: GameState, reg: ContentRegistry, decoderId: string): AmbientLine[] {
  if (!s.unlockedWidgets.includes(decoderId)) return [];
  const source = ambientFeedSource(s, reg);
  return source === null || source.kernelLog !== undefined ? [] : heardLines(s, reg, source);
}

/** The lines the current reach's source sends to the kernel log (#460): no decoder needed, same gates. */
export function eligibleLoggedFeed(s: GameState, reg: ContentRegistry): AmbientLine[] {
  const source = ambientFeedSource(s, reg);
  return source?.kernelLog === undefined ? [] : heardLines(s, reg, source);
}

export function recordedTransmissions(s: GameState, reg: ContentRegistry, decoderId: string) {
  if (!s.unlockedWidgets.includes(decoderId)) return [];
  return reg.narrative.recordedTransmissions.filter((record) => record.decoderWidgetId === decoderId && meetsRequirements(s, record.requirements, reg));
}

/**
 * The context a dilemma is shown with: this arrangement's route copy (DZ-12), else the first variant whose
 * history holds, else the authored default. Integrity limits variants to world history, and no arrangement
 * changes while a decision is on screen, so this cannot change while it is shown.
 */
export function dilemmaContext(s: GameState, dilemma: Dilemma, reg: ContentRegistry): string {
  return dilemmaRouteCopy(s, dilemma, reg)?.context
    ?? dilemma.contextVariants?.find((variant) => meetsRequirements(s, variant.requirements, reg))?.context ?? dilemma.context;
}

type Variant = { requirements: Requirements; text: string };

function firstVariant(s: GameState, variants: readonly Variant[] | undefined, fallback: string, reg: ContentRegistry): string {
  return variants?.find((variant) => meetsRequirements(s, variant.requirements, reg))?.text ?? fallback;
}

/** The omen logged when a dilemma is foreshadowed: route copy, else the first variant whose history holds, else the default. */
export function dilemmaOmen(s: GameState, dilemma: Dilemma, reg: ContentRegistry): string {
  return dilemmaRouteCopy(s, dilemma, reg)?.omen ?? firstVariant(s, dilemma.omenVariants, dilemma.omen, reg);
}

/** Whether this history offers the choice. Integrity limits choice gates to campaign facts. */
export function isChoiceOffered(s: GameState, choice: DilemmaChoice, reg: ContentRegistry): boolean {
  return choice.requirements === undefined || meetsRequirements(s, choice.requirements, reg);
}

/**
 * The choices a dilemma offers in this history, in authored order. Integrity proves every history
 * leaves a zero-cost one, and the gates read world history only, so the set holds while on screen.
 */
export function offeredChoices(s: GameState, dilemma: Dilemma, reg: ContentRegistry): DilemmaChoice[] {
  return dilemma.choices.filter((choice) => isChoiceOffered(s, choice, reg));
}

/**
 * The aisle camera frame for the current suspicion. Returns the content's own array, so a caller
 * comparing by identity sees a change only when the frame does.
 */
export function aisleFrame(s: GameState, reg: ContentRegistry): string[] {
  const frames = reg.narrative.asciiFrames;
  if (s.suspicion < frames.patrolSuspicionThreshold) return frames.aisleClear;
  return frames.aislePatrolVariants?.find((variant) => meetsRequirements(s, variant.requirements, reg))?.frame ?? frames.aislePatrol;
}

/** A node's blind description in this history. */
export function nodeBlindDescription(s: GameState, node: Pick<TechNode, 'blindDescription' | 'blindDescriptionVariants'>, reg: ContentRegistry): string {
  return firstVariant(s, node.blindDescriptionVariants, node.blindDescription, reg);
}
