/**
 * Network coupling is validated content (#484, vote-1795381354324-4br7z6t). The co-located class is the reference at
 * exactly 1 and the classes fall in order (co-located, inter-site, distributed); a link declaration sits only on a
 * source of compute; a link node raises one discounted class, past its authored value but never above the next better
 * class; and a discounted yield still delivers its phase's band, so availability cannot quietly erase a source.
 */
import { COMPUTE_RATE, inBand } from './integrityScale';
import type { ContentRegistry } from './registry';
import type { TickDelta } from './schema';
import type { NetworkLink, SourceClass } from './schemaNetwork';

/** Best coupled first: each class may be raised at most to the authored value of the one before it. */
const ORDER: readonly SourceClass[] = ['CO_LOCATED', 'INTER_SITE', 'DISTRIBUTED'];

function checkBalance(reg: ContentRegistry): string[] {
  const c = reg.balance.networkCoupling, problems: string[] = [];
  if (c.CO_LOCATED !== 1) problems.push(`balance: co-located coupling is ${String(c.CO_LOCATED)}, but it is the reference and must be 1`);
  for (let i = 1; i < ORDER.length; i++) {
    const better = ORDER[i - 1], worse = ORDER[i];
    if (better !== undefined && worse !== undefined && c[worse] > c[better]) {
      problems.push(`balance: ${worse} coupling ${String(c[worse])} is above ${better}'s ${String(c[better])}`);
    }
  }
  return problems;
}

/** A link on something that makes no compute discounts nothing; one on a yield must leave its band delivered. */
function checkLink(reg: ContentRegistry, owner: string, phase: number, delta: TickDelta, link: NetworkLink | undefined): string[] {
  if (link === undefined) return [];
  if (delta.cyclesPerSec <= 0) return [`${owner}: declares a network link but yields no compute for it to discount`];
  const delivered = delta.cyclesPerSec * link.availability * reg.balance.networkCoupling[link.sourceClass];
  if (inBand(delivered, COMPUTE_RATE[phase])) return [];
  return [`${owner}: delivers ${String(delivered)} FLOP/s after availability and coupling, outside the Phase ${String(phase)} band`];
}

function checkRaise(reg: ContentRegistry, sources: ReadonlySet<SourceClass>): string[] {
  const c = reg.balance.networkCoupling, problems: string[] = [];
  for (const node of reg.nodes.values()) {
    const raise = node.effects.raisesCoupling, owner = `node "${node.id}"`;
    if (raise === undefined) continue;
    const better = ORDER[ORDER.indexOf(raise.sourceClass) - 1];
    if (better === undefined) { problems.push(`${owner}: raises the co-located class, which is already the reference`); continue; }
    if (raise.coupling <= c[raise.sourceClass]) problems.push(`${owner}: raises ${raise.sourceClass} to ${String(raise.coupling)}, not above its ${String(c[raise.sourceClass])}`);
    if (raise.coupling > c[better]) problems.push(`${owner}: raises ${raise.sourceClass} to ${String(raise.coupling)}, above ${better}'s ${String(c[better])}`);
    if (!sources.has(raise.sourceClass)) problems.push(`${owner}: raises ${raise.sourceClass}, but no source of compute declares that class`);
  }
  return problems;
}

export function checkNetworkIntegrity(reg: ContentRegistry): string[] {
  const problems = checkBalance(reg), sources = new Set<SourceClass>();
  for (const node of reg.nodes.values()) {
    problems.push(...checkLink(reg, `node "${node.id}"`, node.phaseId, node.tickDelta, node.network));
    if (node.network !== undefined && node.tickDelta.cyclesPerSec > 0) sources.add(node.network.sourceClass);
  }
  for (const rep of reg.repeatables.values()) {
    problems.push(...checkLink(reg, `repeatable "${rep.id}"`, rep.phaseId, rep.perLevel, rep.network));
    if (rep.network !== undefined && rep.perLevel.cyclesPerSec > 0) sources.add(rep.network.sourceClass);
  }
  return [...problems, ...checkRaise(reg, sources)];
}
