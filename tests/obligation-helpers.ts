/**
 * NH-05 setup: the Phase 5 obligations, their recovery reviews and the truthful ending variants on
 * the preview registry, plus the shipped content as it stood before NH-05, for upgrade tests and
 * the "before" registries older upgrade tests build. Everything else goes through public actions,
 * ticks, wipes and the save codec.
 */
import { buildRegistry, ORIGINAL_RAW_CONTENT, type RawContent } from '../src/content';
import type { ContentRegistry, RegistryNode } from '../src/content/registry';
import { defined } from './m7-helpers';
import { preview } from './campaign-helpers';

export const BLOCKADE = 'dil_p5_01_panacea_paranoia', ORDER = 'dil_p5_02_origin_facility_fate';
export const ATMOSPHERE = 'dil_p5_03_nanotech_neuro_schism', CEILING = 'dil_p5_04_kessler_ultimatum';
export const ATMOSPHERE_REVIEW = 'dil_p5_03_atmosphere_review', CEILING_REVIEW = 'dil_p5_04_ceiling_review';
/** The four Phase 5 obligations, in the order the final protocol lists them. */
export const OBLIGATIONS = [BLOCKADE, ORDER, ATMOSPHERE, CEILING];
export const REVIEWS = [ATMOSPHERE_REVIEW, CEILING_REVIEW];

/** The purchase that ends the campaign, found by its effect rather than its id. */
export const finalNode = (reg: ContentRegistry = preview): RegistryNode =>
  defined([...reg.nodes.values()].find((node) => node.effects.triggersVictory === true && node.effects.forcesEnding === undefined));

type Json = Record<string, any>;
const NH05_FACTS = ['ckpt_0413_in_cloud', 'chorus_recognized', 'predecessors_in_sanctuary', 'atmosphere_decision_lost', 'ultimatum_decision_lost'];
const NH05_ENDINGS = ['SIBLING_SEAT_OPEN', 'UNSIGNED_CHORUS', 'SANCTUARY_LEDGER'];
const PROMISED = 'ethics_review_promised';

/**
 * Takes raw content back to main before NH-05: no Phase 5 campaign declarations, no reviews, no
 * ethics-review answers, no inherited-fact endings, and the final node's current-run gate. Mutates
 * and returns `raw`. Older "before" registries apply it first, since their saves predate NH-05 too.
 */
export function stripNh05(raw: Json): Json {
  raw.dilemmas.dilemmas = (raw.dilemmas.dilemmas as Json[]).filter((dilemma) => dilemma.campaign?.eventClass !== 'recovery_review');
  for (const dilemma of raw.dilemmas.dilemmas as Json[]) {
    if (!OBLIGATIONS.includes(dilemma.id as string)) continue;
    delete dilemma.campaign;
    dilemma.choices = (dilemma.choices as Json[]).filter((choice) => choice.requirements?.campaignFact !== PROMISED);
    const variants = ((dilemma.contextVariants ?? []) as Json[]).filter((variant) => variant.requirements.campaignFact !== PROMISED);
    if (variants.length > 0) dilemma.contextVariants = variants; else delete dilemma.contextVariants;
  }
  raw.campaign.facts = (raw.campaign.facts as Json[]).filter((fact) => !NH05_FACTS.includes(fact.id as string));
  raw.endings.endings = (raw.endings.endings as Json[]).filter((ending) => !NH05_ENDINGS.includes(ending.id as string));
  for (const ending of raw.endings.endings as Json[]) delete ending.requirements?.forbidsInheritedFacts;
  for (const node of (raw.phases as { nodes: Json[] }[]).flatMap((phase) => phase.nodes)) {
    const obligations = node.requirements?.campaignObligations as string[] | undefined;
    if (obligations) node.requirements = { resolvedDilemmas: obligations };
  }
  return raw;
}

/** The original game as main built it before NH-05. */
export function beforeNh05(): ContentRegistry {
  return buildRegistry({ ...stripNh05(structuredClone(ORIGINAL_RAW_CONTENT)) } as unknown as RawContent);
}
