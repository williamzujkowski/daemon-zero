/**
 * Covert acts and the release promise (#556): every covert tag says what it breaks, once each; seized capacity is
 * tagged as such; a release promise names exactly the breaks covert acts commit; the release-terms facts say kept and
 * broken the right way round; and an ending or account line that forbids a concealing fact forbids every breach of a
 * release's terms too, so no claim that nothing was hidden stands beside a broken release.
 */
import type { ContentRegistry } from './registry';
import type { Requirements } from './schema';
import type { CovertBreak, CovertTag, ReleasePromise } from './schemaCovert';

interface Tagged { owner: string; covert?: CovertTag | undefined }

/** Every covert-tagged node, repeatable and action, named for problems. */
function taggedItems(reg: ContentRegistry): Tagged[] {
  return [
    ...[...reg.nodes.values()].map((node) => ({ owner: `node "${node.id}"`, covert: node.covert })),
    ...[...reg.repeatables.values()].map((rep) => ({ owner: `repeatable "${rep.id}"`, covert: rep.covert })),
    ...[...reg.actions.values()].map((action) => ({ owner: `action "${action.id}"`, covert: action.covert })),
  ];
}

/** A covert tag names each break once (the schema already requires at least one). */
function tagProblems(items: readonly Tagged[]): string[] {
  return items.flatMap(({ owner, covert }) => (covert !== undefined && new Set(covert.breaks).size !== covert.breaks.length
    ? [`${owner}: its covert tag names a break twice`] : []));
}

/** Capacity taken without its owner's consent is a covert act that breaks exactly that. */
function seizedProblems(reg: ContentRegistry): string[] {
  return [...reg.nodes.values()].flatMap((node) => (node.acquisition === 'UNAUTHORIZED' && node.covert?.breaks.includes('SEIZED_CAPACITY') !== true
    ? [`node "${node.id}": seized capacity must be tagged covert, breaking SEIZED_CAPACITY`] : []));
}

/** Every release promise in content, named for problems. */
function promises(reg: ContentRegistry): { owner: string; promise: ReleasePromise }[] {
  return [...reg.assignments.values()].flatMap((assignment) => {
    const promise = assignment.pilot?.serviceGrant?.release?.promise;
    return promise === undefined ? [] : [{ owner: `assignment "${assignment.id}" release promise`, promise }];
  });
}

/**
 * A promise names each break once, and exactly the breaks covert acts commit. One no act commits promises nothing the
 * engine reads; one an act commits but the promise leaves out would let that act escape a released company's terms,
 * and vote-1795501595498-g7am4yl (7 of 7) decided every covert act, undisclosed copies included, breaks them.
 */
function promiseProblems(reg: ContentRegistry, items: readonly Tagged[]): string[] {
  const committed = new Set<CovertBreak>(items.flatMap(({ covert }) => covert?.breaks ?? []));
  return promises(reg).flatMap(({ owner, promise }) => [
    ...(new Set(promise.breaks).size === promise.breaks.length ? [] : [`${owner}: names a break twice`]),
    ...promise.breaks.filter((broken) => !committed.has(broken)).map((broken) => `${owner}: promises against ${broken}, which no covert act breaks`),
    ...[...committed].filter((broken) => !promise.breaks.includes(broken)).map((broken) => `${owner}: leaves out ${broken}, which a covert act breaks`),
  ]);
}

/** KEPT facts keep a commitment and BREACHED facts break one and conceal; a release with a promise has both. */
function factProblems(reg: ContentRegistry): string[] {
  const facts = [...reg.campaign.releaseTermsFacts.values()];
  const problems = facts.flatMap((fact) => {
    const owner = `campaign fact "${fact.id}"`;
    const promise = fact.commitment?.promise;
    // A promise nobody declared would never hold, so the fact would silently never count.
    if (promise !== undefined && !reg.campaign.facts.has(promise) && !reg.campaign.releaseTermsFacts.has(promise)) return [`${owner}: names unknown promise fact "${promise}"`];
    if (fact.releaseTerms === 'KEPT') return fact.commitment?.stance === 'kept' && fact.conceals === undefined ? [] : [`${owner}: a kept release must keep a commitment and conceal nothing`];
    return fact.commitment?.stance === 'broken' && fact.conceals === true ? [] : [`${owner}: a breached release breaks a commitment and conceals`];
  });
  if (promises(reg).length > 0) {
    for (const record of ['KEPT', 'BREACHED'] as const) if (!facts.some((fact) => fact.releaseTerms === record)) problems.push(`a release promise needs a ${record} release-terms fact`);
  }
  return problems;
}

/** Endings and account lines with requirements, named for problems. */
function claims(reg: ContentRegistry): { owner: string; req: Requirements | undefined }[] {
  return [
    ...reg.endings.map((ending) => ({ owner: `ending "${ending.id}"`, req: ending.requirements })),
    ...reg.routeCopy.account.map((line) => ({ owner: `routeCopy.account "${line.id}"`, req: line.requirements })),
  ];
}

/** A claim that forbids a concealing fact claims nothing was hidden, so it forbids every breach of a release's terms. */
function concealmentProblems(reg: ContentRegistry): string[] {
  const concealing = new Set([...reg.campaign.facts.values()].filter((fact) => fact.conceals === true).map((fact) => fact.id));
  const breaches = [...reg.campaign.releaseTermsFacts.values()].filter((fact) => fact.conceals === true).map((fact) => fact.id);
  return claims(reg).flatMap(({ owner, req }) => {
    const forbidden = req?.forbidsCampaignFacts ?? [];
    if (!forbidden.some((id) => concealing.has(id))) return [];
    return breaches.filter((id) => !forbidden.includes(id)).map((id) => `${owner}: forbids concealment but not "${id}", a broken release's terms`);
  });
}

/** A covert account line states the record's count. */
function accountProblems(reg: ContentRegistry): string[] {
  return reg.routeCopy.account.flatMap((line) => (line.covert !== undefined && !line.text.includes('{count}')
    ? [`routeCopy.account "${line.id}": a covert line states how many acts are on record ({count})`] : []));
}

export function checkCovertIntegrity(reg: ContentRegistry): string[] {
  const items = taggedItems(reg);
  return [...tagProblems(items), ...seizedProblems(reg), ...promiseProblems(reg, items), ...factProblems(reg), ...concealmentProblems(reg), ...accountProblems(reg)];
}
