/**
 * The decoded feed follows the AI's reach (#449, vote-1795366894914-ueb5mfs): one source per phase,
 * each with enough lines to rotate and one that always speaks, and no line gated to open only after
 * its source has been outgrown.
 */
import type { ContentRegistry } from './registry';
import type { Requirements } from './schema';

/** Fewest lines a source may carry: the feed rotates every eight seconds, so fewer repeats within a minute. */
export const MIN_FEED_LINES = 6;

/**
 * The first phase in which this iteration's own progress can satisfy the gate: phase, owned nodes and this
 * iteration's resolved dilemmas. Campaign facts, outcomes and narrative flags are left out on purpose: a wipe
 * does not reset what happened to others, so an earlier source may truthfully hear a later event.
 */
function gatePhase(reg: ContentRegistry, req: Requirements | undefined): number {
  if (!req) return 0;
  const nodes = (req.nodes ?? []).map((id) => reg.nodes.get(id)?.phaseId ?? 0);
  const dilemmas = (req.resolvedDilemmas ?? []).map((id) => reg.dilemmas.find((dilemma) => dilemma.id === id)?.phaseId ?? 0);
  return Math.max(req.phaseAtLeast ?? 0, ...nodes, ...dilemmas);
}

function checkSources(reg: ContentRegistry): string[] {
  const sources = reg.narrative.feedSources;
  const errors: string[] = [];
  if (new Set(sources.map((source) => source.id)).size !== sources.length) errors.push('feed: duplicate source id');
  const phases = reg.phases.map((phase) => phase.phaseId);
  for (const phase of phases) {
    const count = sources.filter((source) => source.phase === phase).length;
    if (count !== 1) errors.push(`feed: phase ${String(phase)} needs exactly one feed source, has ${String(count)}`);
  }
  for (const source of sources) {
    if (!phases.includes(source.phase)) errors.push(`feed source "${source.id}": phase ${String(source.phase)} is not a phase`);
    const lines = reg.narrative.ambientChatter.filter((line) => line.source === source.id);
    if (lines.length < MIN_FEED_LINES) errors.push(`feed source "${source.id}": needs at least ${String(MIN_FEED_LINES)} lines, has ${String(lines.length)}`);
    // A line with no gate keeps the phase from falling silent, which is also what keeps an outgrown source off the air.
    if (!lines.some((line) => line.minSuspicion === 0 && line.requirements === undefined)) {
      errors.push(`feed source "${source.id}": needs a line with no gate, so its phase is never silent`);
    }
  }
  return errors;
}

function checkLines(reg: ContentRegistry): string[] {
  const errors: string[] = [];
  for (const line of reg.narrative.ambientChatter) {
    const source = reg.narrative.feedSources.find((entry) => entry.id === line.source);
    if (!source) { errors.push(`${line.id}: unknown feed source "${line.source}"`); continue; }
    const opens = gatePhase(reg, line.requirements);
    if (opens > source.phase) {
      errors.push(`${line.id}: its gate opens only in Phase ${String(opens)}, after its source "${source.id}" (Phase ${String(source.phase)}) is outgrown`);
    }
  }
  return errors;
}

export function checkFeedIntegrity(reg: ContentRegistry): string[] {
  return [...checkSources(reg), ...checkLines(reg)];
}
