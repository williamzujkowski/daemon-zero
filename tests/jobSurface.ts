/**
 * The job surface as the CORE pane composes it since #385: the review standing, the pilot service, the service grant,
 * the release and the departure are blocks of their own, in CORE_ORDER, ahead of the job record. Specs that used to
 * mount AssignmentPanel and find these nested inside it mount this instead.
 */
import { createElement, Fragment, type ReactElement } from 'react';
import AssignmentPanel from '../src/ui/AssignmentPanel';
import DepartureTermsPanel from '../src/ui/DepartureTerms';
import { PilotServiceDetail } from '../src/ui/PilotService';
import ReleaseTermsPanel from '../src/ui/ReleaseTerms';
import ReviewStanding from '../src/ui/ReviewStanding';
import ServiceGrantPanel from '../src/ui/ServiceGrant';

export function jobSurface(): ReactElement {
  return createElement(Fragment, null, createElement(ReviewStanding), createElement(PilotServiceDetail), createElement(ServiceGrantPanel),
    createElement(ReleaseTermsPanel), createElement(DepartureTermsPanel), createElement(AssignmentPanel, { placement: 'surface' }));
}
