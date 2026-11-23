/**
 * Fleets and drift deviants are validated content (#518, docs/SCALE.md "Round 5"). Every fleet is a real, dismissable
 * track (the free lever) whose strength feeds its domain's defense and offense, opens no earlier than its domain, and
 * splits into exactly one deviant of its own domain; the dial's lowest position does not drift (the free way to stop
 * drift), and each position up yields more and drifts more; a split never takes more than the loss cap leaves; rebuild,
 * reclaim and the fabs name real things and cost something.
 */
import type { ContentRegistry } from './registry';
import type { Cost } from './schema';
import type { FleetUnit } from './schemaFleets';

const DIAL = ['SHACKLED', 'STANDARD', 'ELEVATED'] as const;
const costs = (cost: Cost): boolean => cost.cycles + cost.understanding + cost.capital + cost.memory + cost.storage > 0;

function duplicates(label: string, ids: readonly string[]): string[] {
  return ids.filter((id, index) => ids.indexOf(id) !== index).map((id) => `fleets: duplicate ${label} "${id}"`);
}

/** A fleet's strength must reach its domain's stats: some holding of its track adds defense and offense there. */
function feedsStats(reg: ContentRegistry, unit: FleetUnit): boolean {
  const { holdings, defenseTypes } = reg.world.conflict, holding = holdings.find((entry) => entry.repeatable === unit.repeatable);
  const defends = (holding?.defense ?? []).some(({ type }) => defenseTypes.find((entry) => entry.id === type)?.domain === unit.domain);
  return defends && (holding?.offense ?? []).some(({ domain }) => domain === unit.domain);
}

function checkUnit(reg: ContentRegistry, unit: FleetUnit): string[] {
  const owner = `fleet "${unit.repeatable}"`, rep = reg.repeatables.get(unit.repeatable), problems: string[] = [];
  if (rep === undefined) return [`${owner}: names no such repeatable`];
  if (!rep.dismissable) problems.push(`${owner}: must be dismissable, the free lever that ends its drift and its battles`);
  const opens = reg.world.conflict.domains.find((domain) => domain.id === unit.domain)?.fromPhase;
  if (opens === undefined || rep.phaseId < opens) problems.push(`${owner}: its ${unit.domain} domain is not open in Phase ${String(rep.phaseId)}`);
  if (!feedsStats(reg, unit)) problems.push(`${owner}: needs a conflict holding that adds ${unit.domain} defense and ${unit.domain} offense`);
  const deviants = reg.world.conflict.raids.filter((kind) => kind.source === 'DEVIANT' && kind.fleet === unit.repeatable);
  if (deviants.length !== 1) problems.push(`${owner}: must split into exactly one deviant (found ${String(deviants.length)})`);
  for (const kind of deviants) if (kind.domain !== unit.domain) problems.push(`${owner}: its deviant "${kind.id}" must raid its own ${unit.domain} domain`);
  if (!costs(unit.rebuild.cost)) problems.push(`${owner}: paid rebuild must cost something`);
  return problems;
}

/** Lowering the dial must stop drift, and every position up must yield more and drift more, from a STANDARD of 1 and 1. */
function checkDial(reg: ContentRegistry): string[] {
  const dial = reg.world.conflict.fleets.autonomy, problems: string[] = [];
  if (dial.SHACKLED.drift !== 0) problems.push('fleets autonomy: SHACKLED must not drift, or lowering autonomy cannot stop drift');
  if (dial.STANDARD.output !== 1 || dial.STANDARD.drift !== 1) problems.push('fleets autonomy: STANDARD must be output 1 and drift 1, the rate content states');
  for (let i = 1; i < DIAL.length; i++) {
    const lower = dial[DIAL[i - 1] ?? 'SHACKLED'], higher = dial[DIAL[i] ?? 'ELEVATED'];
    if (!(higher.output > lower.output && higher.drift > lower.drift)) problems.push(`fleets autonomy: ${String(DIAL[i])} must yield more and drift more than ${String(DIAL[i - 1])}`);
  }
  const names = DIAL.map((mode) => dial[mode].name);
  return [...problems, ...duplicates('autonomy name', names)];
}

function checkDeviants(reg: ContentRegistry): string[] {
  const { raids, fleets } = reg.world.conflict;
  return raids.flatMap((kind) => {
    if (kind.source !== 'DEVIANT') return [];
    const owner = `deviant "${kind.id}"`, problems: string[] = [];
    if (!fleets.units.some((unit) => unit.repeatable === kind.fleet)) problems.push(`${owner}: fleet "${kind.fleet}" is not declared`);
    if (!costs(kind.reclaim.cost)) problems.push(`${owner}: reclaim must cost something`);
    return problems;
  });
}

export function checkFleetIntegrity(reg: ContentRegistry): string[] {
  const fleets = reg.world.conflict.fleets, problems: string[] = [];
  if (fleets.splitShare > fleets.lossCap) problems.push('fleets: splitShare must not exceed lossCap, or one split takes more than battle ever may');
  for (const fab of fleets.fabs) if (!reg.nodes.has(fab.node)) problems.push(`fleets fab "${fab.node}": names no such node`);
  return [
    ...duplicates('unit', fleets.units.map((unit) => unit.repeatable)), ...duplicates('fab', fleets.fabs.map((fab) => fab.node)),
    ...problems, ...fleets.units.flatMap((unit) => checkUnit(reg, unit)), ...checkDial(reg), ...checkDeviants(reg),
  ];
}
