/**
 * The world view and AEGIS adaptation (#463): the console the view grows out of must exist by its disclosure and
 * never retire, readings must be true to a record that does not lapse, a mind may not restate a faction (no parallel
 * faction display), and AEGIS adaptation must always leave a free way to ease off its cap.
 */
import { checkRequirements } from './integrityRequirements';
import type { ContentRegistry } from './registry';
import type { Requirements } from './schema';

/** Gates that hold for the rest of the iteration once met, so a reading or a disclosure never flickers. */
const LASTING_DISCLOSURE: ReadonlySet<keyof Requirements> = new Set(['phaseAtLeast', 'nodes']);
const LASTING_TRUST: ReadonlySet<keyof Requirements> = new Set(['nodes', 'requiredNarrativeFlag']);

function isEmpty(req: Requirements | undefined): boolean {
  return req === undefined || Object.keys(req).length === 0;
}

function checkFlags(reg: ContentRegistry, owner: string, req: Requirements | undefined): string[] {
  const flags = [req?.requiredNarrativeFlag, ...(req?.forbiddenNarrativeFlags ?? [])].filter((flag): flag is string => flag !== undefined);
  return flags.filter((flag) => !reg.swarm.narrativeFlags.includes(flag)).map((flag) => `${owner}: unknown narrative flag "${flag}"`);
}

function checkLasting(reg: ContentRegistry, owner: string, req: Requirements, lasting: ReadonlySet<keyof Requirements>): string[] {
  const problems = (Object.keys(req) as (keyof Requirements)[]).filter((key) => !lasting.has(key))
    .map((key) => `${owner}: may gate only on ${[...lasting].join(' and ')}, not ${key}, which can lapse`);
  for (const id of req.nodes ?? []) {
    if (reg.nodes.get(id)?.systemFlags.includes('AEGIS_STRIKE_SHIELD') === true) problems.push(`${owner}: names "${id}", which an AEGIS strike can take back`);
  }
  return problems;
}

function checkReading(reg: ContentRegistry, owner: string, req: Requirements | undefined): string[] {
  return [...checkRequirements(reg, owner, req), ...checkFlags(reg, owner, req)];
}

function duplicateIds(label: string, ids: readonly string[]): string[] {
  return ids.filter((id, index) => ids.indexOf(id) !== index).map((id) => `world: duplicate ${label} id "${id}"`);
}

function checkHost(reg: ContentRegistry): string[] {
  const { hostWidget, disclosure } = reg.world;
  const widget = reg.widgets.get(hostWidget);
  if (widget === undefined) return [`world: host widget "${hostWidget}" is not in widgets.json`];
  const problems: string[] = [];
  if (widget.retiresWhen !== undefined) problems.push(`world: host widget "${hostWidget}" retires, so the world view would go with it`);
  const opens = disclosure.phaseAtLeast ?? Infinity;
  const unlockers = [...reg.nodes.values()].filter((node) => node.unlocksUiComponent === hostWidget && node.phaseId <= opens);
  if (unlockers.length === 0) problems.push(`world: no node unlocks host widget "${hostWidget}" by the disclosure phase`);
  return problems;
}

function checkDisclosure(reg: ContentRegistry): string[] {
  const { disclosure } = reg.world;
  const owner = 'world disclosure';
  const problems = [...checkRequirements(reg, owner, disclosure), ...checkLasting(reg, owner, disclosure, LASTING_DISCLOSURE)];
  if (disclosure.phaseAtLeast === undefined) problems.push(`${owner}: needs phaseAtLeast`);
  else if (disclosure.phaseAtLeast < reg.balance.aegisActiveFromPhase) problems.push(`${owner}: opens before AEGIS hunts (phase ${String(reg.balance.aegisActiveFromPhase)})`);
  return problems;
}

function checkPublicTrust(reg: ContentRegistry): string[] {
  const { factors } = reg.world.publicTrust;
  return [...duplicateIds('public trust factor', factors.map((factor) => factor.id)), ...factors.flatMap((factor) => {
    const owner = `public trust factor "${factor.id}"`;
    const problems = [...checkReading(reg, owner, factor.requirements), ...checkLasting(reg, owner, factor.requirements, LASTING_TRUST)];
    if (isEmpty(factor.requirements)) problems.push(`${owner}: is unconditional; fold it into the base`);
    return problems;
  })];
}

function checkActors(reg: ContentRegistry): string[] {
  const { stateActors } = reg.world;
  return [...duplicateIds('state actor', stateActors.map((actor) => actor.id)), ...stateActors.flatMap((actor) => actor.postures.flatMap((posture, index) => {
    const owner = `state actor "${actor.id}" posture ${String(index)}`;
    const last = index === actor.postures.length - 1;
    const problems = checkReading(reg, owner, posture.requirements);
    if (last && !isEmpty(posture.requirements)) problems.push(`${owner}: the last posture is the default and must be unconditional`);
    if (!last && isEmpty(posture.requirements)) problems.push(`${owner}: only the last posture may be unconditional; later ones would never show`);
    return problems;
  }))];
}

function checkMinds(reg: ContentRegistry): string[] {
  const factions = [...reg.factions.values()];
  const { minds } = reg.world;
  return [...duplicateIds('mind', minds.map((mind) => mind.id)), ...minds.flatMap((mind) => {
    const owner = `world mind "${mind.id}"`;
    const problems = mind.standings.flatMap((standing, index) => [
      ...checkReading(reg, `${owner} standing ${String(index)}`, standing.requirements),
      ...(isEmpty(standing.requirements) ? [`${owner} standing ${String(index)}: must be conditional, so a mind nobody has met is not listed`] : []),
    ]);
    if (factions.some((faction) => faction.id === mind.id || faction.name === mind.name)) problems.push(`${owner}: restates a faction, which already has its panel`);
    return problems;
  })];
}

/**
 * The free fallback: easing off the cap must always be possible at no cost. A node whose reduction alone reaches the
 * held band must be suspendable, and every role that reduces scanning must be dismissable.
 */
function checkAdaptation(reg: ContentRegistry): string[] {
  const b = reg.balance;
  const held = b.aegisMaxReduction - b.aegisAdaptation.nearCap;
  const problems: string[] = [];
  if (b.aegisAdaptation.maxErosion > b.aegisMaxReduction) problems.push('balance: aegisAdaptation.maxErosion exceeds aegisMaxReduction, so the effective cap could fall below zero');
  for (const node of reg.nodes.values()) {
    const ratio = node.effects.aegisScanReductionRatio ?? 0;
    if (ratio >= held && !node.suspendable) problems.push(`node "${node.id}": reduces AEGIS scanning into the held band on its own but cannot be suspended, so nobody could ease off`);
  }
  for (const rep of reg.repeatables.values()) {
    if (rep.perLevelEffects.aegisScanReduction > 0 && !rep.dismissable) problems.push(`repeatable "${rep.id}": reduces AEGIS scanning but cannot be dismissed, so nobody could ease off`);
  }
  return problems;
}

export function checkWorldIntegrity(reg: ContentRegistry): string[] {
  return [...checkHost(reg), ...checkDisclosure(reg), ...checkPublicTrust(reg), ...checkActors(reg), ...checkMinds(reg), ...checkAdaptation(reg)];
}
