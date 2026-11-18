/**
 * Public surface of the simulation engine. The UI layer imports from here only.
 * Nothing in src/engine may import React, React Native, Expo or a state library,
 * and nothing may read a clock or random source (lint enforces both).
 */
export * from './actions';
export * from './conditioning';
export { computeRates } from './rates';
export { wipe } from './prestige';
export * from './query';
export * from './save';
export * from './state';
export { advance, tick, TICK_PIPELINE } from './tick';
export type { TickContext, TickSystem } from './systems/types';

export * from './epistemic';
export * from './shardActions';
export { shardOutput } from './swarmRates';

export * from './epistemicQuery';
export * from './swarmQuery';

export * from './speechQuery';

export { activateCampaignRules } from './campaign';
export { accessHolds, contextHolds, structuralFailure } from './campaignLifecycle';
export * from './campaignClue';
export { followUpAccess, followUpPrerequisiteHolds, followUpReceipts, type FollowUpReceipt } from './followUp';
export * from './campaignQuery';
export type { CampaignClue, CampaignRecord, CampaignState, NarrativeRules } from './campaignState';

export { eligibleRoutines, routineContext, type RoutineContext, type RoutineOccurrence } from './routine';
export type { RoutineState } from './routineState';
export { isPermitted, permittedUses, runContextView, type RunContextView } from './accessQuery';
export type { AcceptedAssignment, AccessRecord, OperatingContext, Permission, PilotOfferRecord, Qualification, ReviewStanding, RouteEvent, RouteEventKind, RunExit, ScopeEvidence } from './accessState';
export { acceptAssignment, assignmentView, type AssignmentStatus, type AssignmentView } from './assignment';
export { assessmentStage, offerToken } from './assignmentQuery';
export { acceptPilotOffer, pilotOfferView, type PilotOfferStatus, type PilotOfferView } from './pilot';
export { pilotToken, qualifiesForPilot } from './pilotQuery';
