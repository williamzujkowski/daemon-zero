/**
 * An ending's claims (#466): what its epilogue and future state about the record. Every claim must be guaranteed by the
 * ending's own requirements, or by the gates of every node that can end the run in it, so no ending is told on trait
 * counts alone: traits are not a claim, and a claim no gate proves is refused (extending #549's forced-ending check).
 */
import type { ContentRegistry, RegistryNode } from './registry';
import type { Ending, Requirements } from './schema';
import { futureCardText } from './schemaEnding';
import { FUTURE_PLACEHOLDERS } from './schemaFinale';
import { checkRequirements } from './integrityRequirements';
import { requirementsInScope } from './requirementScopes';

type ListKey = 'nodes' | 'resolvedDilemmas' | 'forbidsNodes' | 'forbidsResolvedDilemmas' | 'forbidsCampaignFacts' | 'forbidsInheritedFacts'
  | 'forbiddenNarrativeFlags' | 'campaignObligations';
type OneOfKey = 'relevanceStances' | 'accessContexts';

/** Lists every item of which must hold: the requirement implies each item it names. */
const ALL_OF: readonly ListKey[] = ['nodes', 'resolvedDilemmas', 'forbidsNodes', 'forbidsResolvedDilemmas', 'forbidsCampaignFacts', 'forbidsInheritedFacts',
  'forbiddenNarrativeFlags', 'campaignObligations'];
/** Lists met by any one item: the requirement implies the claim only when it allows no item the claim leaves out. */
const ONE_OF: readonly OneOfKey[] = ['relevanceStances', 'accessContexts'];

function residualList(key: ListKey, req: Requirements, claim: readonly string[]): Requirements {
  const missing = claim.filter((item) => !(req[key] ?? []).includes(item));
  return missing.length === 0 ? {} : { [key]: missing };
}

function residualOneOf(key: OneOfKey, req: Requirements, claim: readonly string[]): Requirements {
  const allowed: readonly string[] | undefined = req[key];
  return allowed !== undefined && allowed.every((item) => claim.includes(item)) ? {} : { [key]: claim };
}

function sameOutcome(a: Requirements['campaignOutcome'], b: Requirements['campaignOutcome']): boolean {
  return a !== undefined && b !== undefined && a.event === b.event && a.outcome === b.outcome;
}

function residualScalar(key: keyof Requirements, req: Requirements, claims: Requirements): Requirements {
  const claim = claims[key];
  if (key === 'phaseAtLeast') return (req.phaseAtLeast ?? 0) >= (claims.phaseAtLeast ?? 0) ? {} : { phaseAtLeast: claims.phaseAtLeast };
  if (key === 'campaignOutcome') return sameOutcome(req.campaignOutcome, claims.campaignOutcome) ? {} : { campaignOutcome: claims.campaignOutcome };
  return req[key] === claim ? {} : { [key]: claim };
}

/** The part of `claims` that `req` does not already guarantee. */
export function unimpliedClaims(req: Requirements, claims: Requirements): Requirements {
  let rest: Requirements = {};
  for (const key of Object.keys(claims) as (keyof Requirements)[]) {
    const list = ALL_OF.find((entry) => entry === key);
    const oneOf = ONE_OF.find((entry) => entry === key);
    const part = list !== undefined ? residualList(list, req, claims[list] ?? [])
      : oneOf !== undefined ? residualOneOf(oneOf, req, claims[oneOf] ?? []) : residualScalar(key, req, claims);
    rest = { ...rest, ...part };
  }
  return rest;
}

/** Every node whose purchase ends the run in `ending`: its forcing nodes, or, for a chosen ending, every unforced finale. */
export function reachingNodes(reg: ContentRegistry, ending: Ending): RegistryNode[] {
  return [...reg.nodes.values()].filter((node) => node.effects.triggersVictory === true
    && (ending.forcedOnly ? node.effects.forcesEnding === ending.id : node.effects.forcesEnding === undefined));
}

export type ProveFromNode = (reg: ContentRegistry, node: RegistryNode, evidence: Requirements) => string[];

/**
 * A variant must state its claims, and so must a forced ending with requirements; each claim its requirements do not
 * guarantee must be proven by every node that can reach it (`prove`, #549's node-gate rule).
 */
export function checkEndingClaims(reg: ContentRegistry, prove: ProveFromNode): string[] {
  return reg.endings.flatMap((ending) => {
    const needs = ending.variantOf !== undefined || (ending.forcedOnly && ending.requirements !== undefined);
    if (ending.claims === undefined) return needs ? [`${ending.id}: an ending variant or evidenced forced ending must state its claims`] : [];
    const rest = unimpliedClaims(ending.requirements ?? {}, ending.claims);
    if (Object.keys(rest).length === 0) return [];
    const nodes = reachingNodes(reg, ending);
    if (nodes.length === 0) return [`${ending.id}: claims ${Object.keys(rest).join(', ')} that no requirement guarantees and no node can prove`];
    return nodes.flatMap((node) => prove(reg, node, rest).map((what) => `${ending.id}: its claim (${what}) is guaranteed neither by its requirements nor by node "${node.id}"`));
  });
}

/** A future card names only the placeholders the engine fills (endingMovements.ts), so no card is shown half-written. */
export function checkFuturePlaceholders(reg: ContentRegistry): string[] {
  return reg.endings.flatMap((ending) => ending.future.flatMap((card) => [...futureCardText(card).matchAll(/\{([a-zA-Z]+)\}/g)]
    .map((match) => match[1] ?? '').filter((name) => !FUTURE_PLACEHOLDERS.includes(name))
    .map((name) => `${ending.id}: future names {${name}}, which the engine does not fill`)));
}

/** Besides world history, a card may read the one lasting fact of the ending instance its prose turns on (#564). */
const CARD_GATES: ReadonlySet<keyof Requirements> = new Set(['relevanceThreshold']);

/**
 * Gated future cards (#564 panel): each gate reads only what cannot change once the run has ended (world history, the
 * stance, the threshold), and at least one card is ungated, so WHAT COMES AFTER is never empty.
 */
export function checkFutureGates(reg: ContentRegistry): string[] {
  return reg.endings.flatMap((ending) => {
    const owner = `${ending.id} future`;
    const problems = ending.future.some((card) => typeof card === 'string') ? [] : [`${owner}: needs at least one ungated card`];
    for (const card of ending.future) {
      if (typeof card === 'string') continue;
      problems.push(...checkRequirements(reg, owner, card.requirements));
      const history = Object.keys(requirementsInScope(card.requirements, 'context'));
      const stray = Object.keys(card.requirements).filter((key) => !history.includes(key) && !CARD_GATES.has(key as keyof Requirements));
      if (stray.length > 0) problems.push(`${owner}: a card's gate may read only world history and the threshold, not ${stray.join(', ')}`);
    }
    return problems;
  });
}
