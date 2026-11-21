/**
 * When each job-surface block shows, exactly as it did nested in the job record before #385 lifted it out: the
 * standing with the reviewed evidence, the pilot service and grant with an accepted pilot under it, the release and
 * departure with a submitted assignment. The views alone are wider: the offer stays accepted and misconduct stays on
 * record after a release or a departure, when the reviewed evidence (and so the job record's panels) is gone.
 */
import { CONTENT } from '../content';
import { assignmentView, pilotOfferView, type GameState } from '../engine';

export interface JobSurfaceGates { standing: boolean; service: boolean; terms: boolean }

export function jobSurfaceGates(game: GameState): JobSurfaceGates {
  const submitted = assignmentView(game, CONTENT)?.status === 'submitted';
  const reviewed = submitted && game.access.qualification?.result != null;
  const piloting = reviewed && pilotOfferView(game, CONTENT)?.status === 'accepted';
  return { standing: reviewed, service: piloting, terms: submitted };
}
