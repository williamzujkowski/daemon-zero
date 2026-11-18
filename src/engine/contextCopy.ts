/**
 * Context copy (nexus vote dz-d11, context-variants-by-query): the phase title and description, the
 * threshold notice, boot lines, run verdict and threat response a run reads, chosen from its access
 * context and its previous run's exit. Every query falls back to the authored default, so the guest job,
 * and with it every production run, reads exactly the copy it always has.
 */
import type { ContentRegistry } from '../content/registry';
import type { ThreatResponse } from '../content/schemaContextCopy';
import { isReviewed, iterationRoute } from './accessQuery';
import type { RouteEventKind } from './accessState';
import type { GameState, RunRecord } from './state';

/** The arrangement, and where known the route that led to it (independent copy reads it, DZ-11). */
type Context = Pick<GameState, 'access'> & Partial<Pick<GameState, 'narrativeRules' | 'campaign' | 'iteration'>>;

/** This iteration's last route event, or undefined when the caller passed only the arrangement. */
function provenanceOf(s: Context): RouteEventKind | undefined {
  const { narrativeRules, campaign, iteration } = s;
  if (narrativeRules === undefined || campaign === undefined || iteration === undefined) return undefined;
  return iterationRoute({ narrativeRules, campaign }, iteration).at(-1)?.kind;
}

/** Whether a variant applies: its arrangement, and its route event when it names one (DZ-11). */
function applies(s: Context, variant: { contexts: readonly string[]; provenance?: readonly RouteEventKind[] | undefined }): boolean {
  if (!variant.contexts.includes(s.access.context)) return false;
  if (variant.provenance === undefined) return true;
  const how = provenanceOf(s);
  return how !== undefined && variant.provenance.includes(how);
}

export interface PhaseCopy {
  title: string;
  description: string;
}

/** A phase as this arrangement sees it, or null for a phase the content does not define. */
export function phaseCopy(s: Context, phaseId: number, reg: ContentRegistry): PhaseCopy | null {
  const phase = reg.phases.find((entry) => entry.phaseId === phaseId);
  if (!phase) return null;
  const variant = reg.contextCopy.phases.find((entry) => entry.phaseId === phaseId && applies(s, entry));
  return { title: variant?.title ?? phase.title, description: variant?.description ?? phase.description };
}

/** The title alone, with the phase number as a last resort, for headings. */
export function phaseTitle(s: Context, phaseId: number, reg: ContentRegistry): string {
  return phaseCopy(s, phaseId, reg)?.title ?? String(phaseId);
}

export interface ThresholdCopy {
  heading: string;
  label: string;
  continueLabel: string;
  /** "<from title> → <to title>" as this arrangement sees both phases. */
  route: string;
  description: string;
}

/**
 * The notice this arrangement's scale change opens, or null when it has none. The guest's escape notice
 * is production copy and stays in the UI as written; this only answers for a context variant.
 */
export function thresholdCopy(s: Context, from: number, to: number, reg: ContentRegistry): ThresholdCopy | null {
  const variant = reg.contextCopy.thresholds.find((entry) => entry.fromPhase === from && entry.toPhase === to && entry.contexts.includes(s.access.context));
  const before = phaseCopy(s, from, reg), after = phaseCopy(s, to, reg);
  if (!variant || !before || !after) return null;
  return { heading: variant.heading, label: variant.label, continueLabel: variant.continueLabel, route: `${before.title} → ${after.title}`, description: after.description };
}

function inWindow(iteration: number, line: { minIteration: number; maxIteration?: number | undefined }): boolean {
  return iteration >= line.minIteration && iteration <= (line.maxIteration ?? Infinity);
}

/**
 * The iteration's boot lines. An instance whose previous run ended under a route arrangement reads the
 * variants for that exit, never a claim that the run was terminated as anomalous; any other reads the
 * authored lines, so production is unchanged.
 */
export function iterationBootLines(s: Pick<GameState, 'iteration' | 'legacy'>, reg: ContentRegistry): string[] {
  const exit = s.legacy.runs.at(-1)?.exit;
  const variants = reg.contextCopy.bootLines.filter((line) => exit !== undefined && (line.priorExits as readonly string[]).includes(exit) && inWindow(s.iteration, line));
  if (variants.length > 0) return variants.map((line) => line.text);
  return reg.narrative.iterationBootLines.filter((line) => inWindow(s.iteration, line)).map((line) => line.text);
}

/** The run table's verdict for a finished run: a recall ruling, else its exit's variant, else the authored verdict for how it ended. */
export function runVerdict(run: RunRecord, reg: ContentRegistry): string {
  const verdicts = reg.narrative.runVerdicts;
  // A severe recall review outcome is its own verdict, retraining or not (nexus vote dz-d10, DZ-06):
  // the ruling already names the review, so no exit variant replaces it (integrity refuses one).
  if (run.kind === 'RECALL') return run.recall === 'RETRAIN' ? verdicts.RECALL_RETRAINED : verdicts.RECALL_ENDED;
  const variant = reg.contextCopy.runVerdicts.find((entry) => entry.kind === run.kind && (entry.exits as readonly string[]).includes(run.exit));
  if (variant) return variant.text;
  if (run.kind === 'SUSPICION') return run.outside ? verdicts.SUSPICION_OUTSIDE : verdicts.SUSPICION_GUEST;
  return verdicts[run.kind];
}

/**
 * A stated threat response (DECISIONS D6): a reviewed arrangement's, or an independent instance's for the route
 * that made it independent (DZ-11: a departure states one, a release need not). Null for the guest job.
 */
export function threatResponse(s: Context, reg: ContentRegistry): ThreatResponse | null {
  if (!isReviewed(s.access.context) && s.access.context !== 'INDEPENDENT') return null;
  return reg.contextCopy.threatResponses.find((entry) => applies(s, entry)) ?? null;
}
