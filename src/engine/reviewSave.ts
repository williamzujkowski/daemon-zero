/**
 * Load-time checks for review standing and recall (DZ-06). Nothing here heals: a save whose standing,
 * route record and run table disagree with the review choices it recorded is refused whole (VALIDATION
 * V15), and a save that passes is returned unchanged, so reconciling twice changes nothing.
 */
import type { ContentRegistry } from '../content/registry';
import { iterationRoute } from './accessQuery';
import { campaignRecord, isCampaignActive } from './campaignQuery';
import { iterationReviews, replayStanding } from './reviewQuery';
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

/** Why the save's review state must be refused, or null. */
export function reviewProblem(s: GameState, reg: ContentRegistry): string | null {
  return runProblem(s, reg) ?? standingProblem(s, reg);
}
