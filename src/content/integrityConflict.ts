/**
 * The conflict foundation is validated content (#517, docs/SCALE.md "Round 5"). Every holding names one real node or
 * track and real types and classes; a damaged class's members have compute to lose; each defense type answers vectors of
 * its own domain; each raid is gated to its tier, needs the decoded mind whose tools show it, strikes classes of its own
 * domain, meets a defense some holding provides, and every domain open in a raided phase is raided; attribution's rate is
 * exact; stage clocks land on tick steps; and every raided phase declares the signature reference a raid's force reads.
 */
import type { ContentRegistry } from './registry';
import type { ConflictHolding, RaidKind, RivalRaid } from './schemaConflict';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function duplicates(label: string, ids: readonly string[]): string[] {
  return ids.filter((id, index) => ids.indexOf(id) !== index).map((id) => `conflict: duplicate ${label} "${id}"`);
}

function holdingOwner(entry: ConflictHolding): string {
  return entry.node !== undefined ? `node "${entry.node}"` : `repeatable "${String(entry.repeatable)}"`;
}

/** What one holding's compute is: a node's own, a track's per level. Undefined where it names nothing real. */
function holdingCompute(reg: ContentRegistry, entry: ConflictHolding): number | undefined {
  if (entry.node !== undefined) return reg.nodes.get(entry.node)?.tickDelta.cyclesPerSec;
  return entry.repeatable === undefined ? undefined : reg.repeatables.get(entry.repeatable)?.perLevel.cyclesPerSec;
}

function checkHolding(reg: ContentRegistry, entry: ConflictHolding): string[] {
  const { siteClasses, defenseTypes } = reg.world.conflict, problems: string[] = [];
  if ((entry.node === undefined) === (entry.repeatable === undefined)) return ['conflict holding: must name exactly one of node and repeatable'];
  const owner = `conflict holding ${holdingOwner(entry)}`, compute = holdingCompute(reg, entry);
  if (compute === undefined) return [`${owner}: names no such ${entry.node !== undefined ? 'node' : 'repeatable'}`];
  if (entry.siteClass !== undefined) {
    const cls = siteClasses.find((candidate) => candidate.id === entry.siteClass);
    if (cls === undefined) problems.push(`${owner}: site class "${entry.siteClass}" is not declared`);
    else if (cls.holds === 'INCOME') problems.push(`${owner}: site class "${cls.id}" holds income, which has no member holdings`);
    else if (compute <= 0) problems.push(`${owner}: a member of site class "${cls.id}" must yield compute, or damage takes nothing from it`);
  }
  for (const { type } of entry.defense ?? []) if (!defenseTypes.some((candidate) => candidate.id === type)) problems.push(`${owner}: defense type "${type}" is not declared`);
  if (entry.siteClass === undefined && entry.defense === undefined && entry.offense === undefined && entry.repairPerSec === undefined) {
    problems.push(`${owner}: adds nothing to the conflict`);
  }
  return problems;
}

function checkTypes(reg: ContentRegistry): string[] {
  const { defenseTypes, vectors } = reg.world.conflict;
  return defenseTypes.flatMap((type) => Object.keys(type.counters).flatMap((vectorId) => {
    const vector = vectors.find((entry) => entry.id === vectorId);
    if (vector === undefined) return [`defense type "${type.id}": counters vector "${vectorId}", which is not declared`];
    return vector.domain === type.domain ? [] : [`defense type "${type.id}": a ${type.domain} defense cannot counter ${vector.domain} vector "${vectorId}"`];
  }));
}

/** Whether some holding provides a defense type that answers this vector, so investment can always lower a raid's hit share. */
function defendable(reg: ContentRegistry, vectorId: string): boolean {
  const answering = new Set(reg.world.conflict.defenseTypes.filter((type) => (type.counters[vectorId] ?? 0) > 0).map((type) => type.id));
  return reg.world.conflict.holdings.some((entry) => (entry.defense ?? []).some(({ type }) => answering.has(type)));
}

function checkRaidGates(reg: ContentRegistry, raid: RivalRaid, owner: string): string[] {
  const { domains, raid: balance } = reg.world.conflict, problems: string[] = [];
  if (!reg.phases.some((phase) => phase.phaseId === raid.tier)) problems.push(`${owner}: tier ${String(raid.tier)} names no phase`);
  if (raid.requirements.phaseAtLeast !== raid.tier) problems.push(`${owner}: tier ${String(raid.tier)} must be its phaseAtLeast (found ${String(raid.requirements.phaseAtLeast)})`);
  if (raid.tier < balance.fromPhase) problems.push(`${owner}: tier ${String(raid.tier)} is before raid.fromPhase`);
  const opens = domains.find((domain) => domain.id === raid.domain)?.fromPhase;
  if (opens === undefined || raid.tier < opens) problems.push(`${owner}: its ${raid.domain} domain is not open in Phase ${String(raid.tier)}`);
  // Its panel lives in the decoded mind's swarm tools, beside the hostile card, so it must need that decoding (reachability).
  if (raid.requirements.requiresSurveillance !== true) problems.push(`${owner}: must require surveillance, where its panel is shown`);
  if (reg.phases.find((phase) => phase.phaseId === raid.tier)?.powerSignature === undefined) problems.push(`${owner}: Phase ${String(raid.tier)} declares no signature reference for its force`);
  // A fleet (#518) fights by the square law at its lethality; an attrition raid has none to read.
  if ((raid.resolution === 'LANCHESTER') !== (raid.lethality !== undefined)) problems.push(`${owner}: a lethality is declared exactly when it resolves by LANCHESTER`);
  // A hazard (#486) is nobody's tooling: nothing to dissect, and no fleet to meet by the square law.
  if (raid.hazard === true && (raid.forensics !== 0 || raid.resolution !== 'ATTRITION')) problems.push(`${owner}: a hazard yields no forensics and resolves by ATTRITION`);
  return problems;
}

function checkRaid(reg: ContentRegistry, raid: RaidKind): string[] {
  const { vectors, siteClasses } = reg.world.conflict, owner = `raid "${raid.id}"`;
  // A deviant (#518) arrives by a split, not the rotation: its fleet's rules are checked in integrityFleets.ts.
  const problems = raid.source === 'RIVAL' ? checkRaidGates(reg, raid, owner) : [];
  const vector = vectors.find((entry) => entry.id === raid.vector);
  if (vector === undefined) problems.push(`${owner}: vector "${raid.vector}" is not declared`);
  else if (vector.domain !== raid.domain) problems.push(`${owner}: a ${raid.domain} raid cannot come by ${vector.domain} vector "${vector.id}"`);
  else if (!defendable(reg, vector.id)) problems.push(`${owner}: no holding provides a defense that counters "${vector.id}"`);
  for (const id of raid.targets) {
    const cls = siteClasses.find((entry) => entry.id === id);
    if (cls === undefined) problems.push(`${owner}: target "${id}" is not a site class`);
    else if (cls.domain !== raid.domain) problems.push(`${owner}: a ${raid.domain} raid cannot strike ${cls.domain} site class "${id}"`);
  }
  return problems;
}

/** The raids the rotation deals: every kind but a drift deviant, which only a split brings (#518). */
export function rivalRaids(reg: ContentRegistry): RivalRaid[] {
  return reg.world.conflict.raids.flatMap((raid) => (raid.source === 'RIVAL' ? [raid] : []));
}

/**
 * Every domain open in a phase that has rival raids, and holding a site class, is raided in that phase. A hazard (#486) is
 * not a rival, so a phase raided only by hazards (the swarm's, whose threat is its own federation's drift: Round 5) owes
 * no rival to each domain.
 */
function checkCoverage(reg: ContentRegistry): string[] {
  const { domains, siteClasses } = reg.world.conflict, raids = rivalRaids(reg).filter((raid) => raid.hazard !== true);
  return [...new Set(raids.map((raid) => raid.tier))].flatMap((tier) => domains
    .filter((domain) => domain.fromPhase <= tier && siteClasses.some((cls) => cls.domain === domain.id))
    .filter((domain) => !raids.some((raid) => raid.tier === tier && raid.domain === domain.id))
    .map((domain) => `raids: Phase ${String(tier)} has raids but none in the open ${domain.id} domain`));
}

function checkBalance(reg: ContentRegistry): string[] {
  const { raid, siteClasses } = reg.world.conflict, problems: string[] = [];
  const { successes, cycle, stride } = raid.attribution;
  if (successes >= cycle) problems.push('raid attribution: successes must be fewer than the cycle, or attribution is never in doubt');
  if (gcd(stride, cycle) !== 1) problems.push('raid attribution: stride must be coprime to the cycle, or "successes of every cycle" is not exact');
  if (raid.footprint.floor > raid.footprint.ceiling) problems.push('raid footprint: floor must not exceed ceiling');
  const step = reg.balance.tickHz;
  for (const key of ['arrivalSec', 'attributionSec', 'roundSec', 'aftermathSec', 'quietLapseSec'] as const) {
    if (Math.abs(raid[key] * step - Math.round(raid[key] * step)) > 1e-9) problems.push(`raid ${key}: must be a whole number of tick steps (1 / ${String(step)} s)`);
  }
  for (const cls of siteClasses) {
    const cost = cls.repair.cost;
    if (cost.cycles + cost.understanding + cost.capital + cost.memory + cost.storage <= 0) problems.push(`site class "${cls.id}": paid repair must cost something`);
  }
  return problems;
}

export function checkConflictIntegrity(reg: ContentRegistry): string[] {
  const c = reg.world.conflict;
  return [
    ...duplicates('domain', c.domains.map((entry) => entry.id)), ...duplicates('vector', c.vectors.map((entry) => entry.id)),
    ...duplicates('defense type', c.defenseTypes.map((entry) => entry.id)), ...duplicates('site class', c.siteClasses.map((entry) => entry.id)),
    ...duplicates('holding', c.holdings.map((entry) => entry.node ?? entry.repeatable ?? '')), ...duplicates('raid', c.raids.map((entry) => entry.id)),
    ...c.holdings.flatMap((entry) => checkHolding(reg, entry)), ...checkTypes(reg),
    ...c.raids.flatMap((raid) => checkRaid(reg, raid)), ...checkCoverage(reg), ...checkBalance(reg),
  ];
}
