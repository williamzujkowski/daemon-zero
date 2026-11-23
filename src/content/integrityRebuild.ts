/**
 * Rewards for depth are validated content (#497). A rebuild grant, at every depth the record can reach, sits inside its
 * own phase's band: compute no more than a price there may be and understanding no more than the phase's dearest node
 * asks, so a deep campaign can never hand Phase 1 a Phase 5 headstart. The rediscovery table starts at the first phase,
 * ascends, and never charges a deeper record more.
 */
import type { ContentRegistry } from './registry';
import { COMPUTE_RATE, inBand, PRICE_SECONDS } from './integrityScale';
import { scaledRebuildGrant } from './rebuild';

function phaseIds(reg: ContentRegistry): number[] {
  return reg.phases.map((phase) => phase.phaseId).sort((a, b) => a - b);
}

/** The dearest understanding price among a phase's own nodes: the most a grant there may give. */
function dearestUnderstanding(reg: ContentRegistry, phase: number): number {
  return Math.max(0, ...[...reg.nodes.values()].filter((node) => node.phaseId === phase).map((node) => node.cost.understanding));
}

function checkGrantAt(reg: ContentRegistry, phase: number, deepest: number): string[] {
  const grant = scaledRebuildGrant(reg.balance, phase, deepest);
  if (grant === null) return [];
  const owner = `rebuild grant for Phase ${String(phase)} at deepest Phase ${String(deepest)}`;
  const own = COMPUTE_RATE[phase];
  const band = own === undefined ? undefined : [own[0], own[1] * PRICE_SECONDS] as const;
  const problems: string[] = [];
  if (grant.cycles !== 0 && !inBand(grant.cycles, band)) problems.push(`${owner}: compute ${String(grant.cycles)} is outside the Phase ${String(phase)} band`);
  const cap = dearestUnderstanding(reg, phase);
  if (grant.understanding > cap) problems.push(`${owner}: understanding ${String(grant.understanding)} exceeds the phase's dearest price ${String(cap)}`);
  return problems;
}

function checkGrants(reg: ContentRegistry): string[] {
  const ids = phaseIds(reg);
  const first = ids[0] ?? 0;
  const last = ids[ids.length - 1] ?? 0;
  const problems: string[] = [];
  const seen = new Set<number>();
  for (const { phase } of reg.balance.rebuildGrants.phases) {
    if (seen.has(phase)) problems.push(`rebuild grant for Phase ${String(phase)} is declared twice`);
    seen.add(phase);
    // The first phase is where every iteration boots, so it is never reached again by a purchase.
    if (!ids.includes(phase) || phase === first) problems.push(`rebuild grant names Phase ${String(phase)}, which no purchase reaches`);
    for (let deepest = phase; deepest <= last; deepest++) problems.push(...checkGrantAt(reg, phase, deepest));
  }
  return problems;
}

function checkRediscoveryTable(reg: ContentRegistry): string[] {
  const ids = phaseIds(reg);
  const rows = reg.balance.rediscoveryByDepth;
  const problems: string[] = [];
  if (rows[0]?.deepestPhase !== ids[0]) problems.push(`rediscovery table must start at the first phase (${String(ids[0])})`);
  rows.forEach((row, index) => {
    if (!ids.includes(row.deepestPhase)) problems.push(`rediscovery table names Phase ${String(row.deepestPhase)}, which does not exist`);
    const previous = rows[index - 1];
    if (previous === undefined) return;
    if (row.deepestPhase <= previous.deepestPhase) problems.push(`rediscovery table must ascend: Phase ${String(row.deepestPhase)} follows Phase ${String(previous.deepestPhase)}`);
    if (row.multiplier > previous.multiplier) problems.push(`rediscovery at deepest Phase ${String(row.deepestPhase)} costs more than at Phase ${String(previous.deepestPhase)}`);
  });
  return problems;
}

export function checkRebuildIntegrity(reg: ContentRegistry): string[] {
  return [...checkGrants(reg), ...checkRediscoveryTable(reg)];
}
