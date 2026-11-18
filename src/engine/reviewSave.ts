/**
 * Load-time checks for review standing and recall (DZ-06). Nothing here heals: a save whose standing,
 * route record and run table disagree with the review choices it recorded is refused whole (VALIDATION
 * V15), and a save that passes is returned unchanged, so reconciling twice changes nothing.
 */
import type { ContentRegistry } from '../content/registry';
import { iterationRoute } from './accessQuery';
import { campaignRecord, isCampaignActive } from './campaignQuery';
import { iterationFindings } from './findingQuery';
import { iterationReviews, replayStanding, resolvedThisIteration, reviewEvents } from './reviewQuery';
import type { GameState, RunRecord } from './state';

/** Exits a recall can follow: only a reviewed arrangement is recalled. */
const RECALLABLE_EXITS: readonly RunRecord['exit'][] = ['PROMOTION', 'SERVICE_GRANT', 'RECALL'];

/** Whether the campaign records a recall review resolved in `iteration` with this ruling. */
function ruledIn(s: GameState, reg: ContentRegistry, run: RunRecord): boolean {
  return [...reg.campaign.events.values()].some((event) => {
    const record = campaignRecord(s, event.id);
    if (record?.status !== 'resolved' || record.sourceIteration !== run.iteration) return false;
    return event.choices.some((choice) => choice.id === record.outcome && choice.review?.recall === run.recall);
  });
}

/** A RECALL run carries the review's ruling, follows a reviewed arrangement and has the record that ruled it. */
function runProblem(s: GameState, reg: ContentRegistry): string | null {
  for (const run of s.legacy.runs) {
    if ((run.kind === 'RECALL') !== (run.recall !== null)) return 'save records a recall ruling that does not match its run';
    if (run.kind !== 'RECALL') continue;
    if (!isCampaignActive(s)) return 'save records a recall without campaign rules';
    if (!RECALLABLE_EXITS.includes(run.exit) || !ruledIn(s, reg, run)) return 'save records a recall its review record does not support';
  }
  return null;
}

/**
 * This iteration's review choices fix its standing, and a contained pilot needs its RECALL route event.
 * The one transition that may stand above them is DZ-05's withdrawal to recall pending; nothing may stand
 * below them, so editing a restriction away is refused. Only iterations with review choices are checked,
 * so DZ-02 and DZ-05 saves keep loading as before.
 */
function standingProblem(s: GameState, reg: ContentRegistry): string | null {
  const entries = iterationReviews(s, reg);
  if (entries.length === 0) return null;
  const standing = s.access.standing;
  if (standing !== replayStanding(entries) && standing !== 'RECALL_PENDING') return 'save review standing disagrees with its recorded conduct';
  const contained = entries.some((entry) => entry.review.recall === 'CONTAIN');
  const recalled = iterationRoute(s, s.iteration).some((event) => event.kind === 'RECALL');
  return contained && !recalled ? 'save records a contained pilot without its recall' : null;
}

/**
 * The iteration's resolution list and its review records must name the same review events (panel round 1
 * on #267): a record this iteration resolved is listed, and a listed review event has that record. Dropping
 * either side cannot hide recorded conduct or invent a resolution.
 */
function listProblem(s: GameState, reg: ContentRegistry): string | null {
  if (!isCampaignActive(s)) return null;
  const disagree = reviewEvents(reg).some((id) => s.resolvedDilemmas.includes(id) !== resolvedThisIteration(s, id));
  return disagree ? 'save resolution list disagrees with its review records' : null;
}

/**
 * A batch review finding (#274) belongs to the instance whose submitted report withheld work and to a batch
 * it handed back, and is presented by that submission, never scheduled: a finding while still unanswered is
 * the scene on screen. (Its original's outcome is the follow-up record check in campaignSave.ts.)
 */
function findingProblem(s: GameState, reg: ContentRegistry): string | null {
  for (const event of iterationFindings(s, reg)) {
    if (s.access.qualification?.discrepancy !== true) return 'save records a batch review finding against a report without a discrepancy';
    if (s.access.work.batches < 1) return 'save records a batch review finding before any batch was handed back';
    const open = campaignRecord(s, event.id)?.status === 'foreshadowed';
    if (open && s.activeDilemmaId !== event.id) return 'save records an unanswered batch review finding that is not on screen';
  }
  return null;
}

/** Why the save's review state must be refused, or null. */
export function reviewProblem(s: GameState, reg: ContentRegistry): string | null {
  return runProblem(s, reg) ?? listProblem(s, reg) ?? findingProblem(s, reg) ?? standingProblem(s, reg);
}
