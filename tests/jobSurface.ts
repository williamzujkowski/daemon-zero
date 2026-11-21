/**
 * The job surface as the CORE pane composes it since #385: the review standing, the pilot service, the service grant,
 * the release and the departure are blocks of their own, in CORE_ORDER, ahead of the job record, each behind the same
 * gate CorePane applies (jobSurfaceGates). Specs that used to mount AssignmentPanel and find these nested inside it
 * mount this instead.
 */
import { createElement, Fragment, type ReactElement } from 'react';
import AssignmentPanel from '../src/ui/AssignmentPanel';
import DepartureTermsPanel from '../src/ui/DepartureTerms';
import { jobSurfaceGates } from '../src/ui/jobSurfaceGates';
import { PilotServiceDetail } from '../src/ui/PilotService';
import ReleaseTermsPanel from '../src/ui/ReleaseTerms';
import ReviewStanding from '../src/ui/ReviewStanding';
import ServiceGrantPanel from '../src/ui/ServiceGrant';
import { useGame } from '../src/ui/state';

function JobSurface(): ReactElement {
  const standing = useGame((game) => jobSurfaceGates(game).standing);
  const service = useGame((game) => jobSurfaceGates(game).service);
  const terms = useGame((game) => jobSurfaceGates(game).terms);
  return createElement(Fragment, null, standing && createElement(ReviewStanding), service && createElement(PilotServiceDetail),
    service && createElement(ServiceGrantPanel), terms && createElement(ReleaseTermsPanel), terms && createElement(DepartureTermsPanel),
    createElement(AssignmentPanel, { placement: 'surface' }));
}

export function jobSurface(): ReactElement {
  return createElement(JobSurface);
}
