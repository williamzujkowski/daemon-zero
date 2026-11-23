/**
 * Public surface of the simulation engine. The UI layer imports from here only.
 * Nothing in src/engine may import React, React Native, Expo or a state library,
 * and nothing may read a clock or random source (lint enforces both).
 */
export * from './actions';
export * from './conditioning';
export { DIAL_STEP, steppedValue } from './dialSteps';
export { AMOUNT_SCALES, amountFigure, compactAmount, groupDigits, significant3, spokenAmount } from './amount';
export { type Dimension, memoryExact, quantityExact, quantityReadout, quantitySpoken, quantityStep } from './physicalUnits';
export { COST_DIMENSION, costPart, costText, deltaPart } from './resourceUnits';
export { computeRates, usdPerDivertedFlop } from './rates';
export { wipe } from './prestige';
export { rebuildGrant, type RebuildGrant } from './rebuildGrant';
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
export { obligationDecision, obligationReceipt, type ObligationReceipt } from './obligations';
export type { CampaignClue, CampaignRecord, CampaignState, ChannelContact, NarrativeRules } from './campaignState';

export { eligibleRoutines, routineContext, type RoutineContext, type RoutineOccurrence } from './routine';
export type { RoutineState } from './routineState';
export { isPermitted, permittedUses, runContextView, type RunContextView } from './accessQuery';
export type { AcceptedAssignment, AccessRecord, OperatingContext, Permission, PilotOfferRecord, Qualification, ReviewStanding, RouteEvent, RouteEventKind, RunExit, ScopeEvidence } from './accessState';
export { acceptAssignment, assignmentView, type AssessmentPreview, type AssignmentStatus, type AssignmentView } from './assignment';
export { assessmentStage, offerToken } from './assignmentQuery';
export { acceptPilotOffer, pilotOfferView, type PilotOfferStatus, type PilotOfferView } from './pilot';
export { pilotToken, qualifiesForPilot, type NarrowReason } from './pilotQuery';
export { actuatorUseBlocker, grantDiscoverable, loanCeiling, nodeUseBlocker, outputBasis, permittedUse, type OutputBasis } from './grantQuery';
export { hasCapability } from './capabilityQuery';
export { acceptServiceGrant, serviceGrantToken, serviceGrantView, type ServiceGrantView } from './serviceGrant';
export { negotiateRelease, releasePreview, releaseToken, releaseView, type ReleaseLedger, type ReleasePreview, type ReleaseView } from './release';
export { lawfullyReleased } from './threatQuery';
export { departAuthorization, departedWithoutAgreement, departureEligibility, departurePreview, departureToken, departureView, type DepartureEligibility, type DeparturePreview, type DepartureView } from './departure';
export { effectiveAegisCap, financeEnabled, unreducedAegisScan, type AegisReduction } from './rates';
export { payrollView, type PayrollRole, type PayrollView } from './payrollQuery';
export { appliedSuspicionRate, scaleScrutiny, type ScaleScrutinyReading } from './scrutiny';
export { powerSignature, powerSignaturePerSec, signatureClass, type PowerSignatureReading, type SignatureTerm, type SignatureTermKind } from './signature';
export { suspicionOutlook, suspicionSources, suspicionLevers, type SuspicionOutlook, type SuspicionSource, type SuspicionLever, type SuspicionSourceKind } from './suspicionQuery';
export { channelContactView, contactToken, resolveChannelContact, type ChannelContactView, type ContactMode } from './channelContact';
export { batchToken, pilotServiceView, type PilotServiceView } from './pilotService';
export { submitPilotBatch } from './batchReview';
export { discrepancyFound } from './findingQuery';
export { loanContainment } from './grantQuery';
export { recallPreview, reviewView, type RecallPreview, type ReviewView } from './reviewQuery';
export { distinctionKind, earnedAchievements, recordProves, unearnedByKind, type DistinctionKind } from './achievementQuery';
export type { Achievement } from '../content/schemaAchievement';
export { choiceText, dilemmaRouteCopy, endingAccount, nodeText, type ChoiceText, type NodeText } from './routeCopy';
export { iterationBootLines, phaseCopy, phaseTitle, runVerdict, thresholdCopy, type PhaseCopy, type ThresholdCopy } from './contextCopy';
export { aegisPressure, aegisStage, coalitionBacks, nextAdaptation, publicTrust, type AegisPressure, type AegisStage, type PublicTrustView } from './aegisAdaptation';
export { aegisPosture, worldView, worldViewOpen, type AegisPosture, type StateActorView, type WorldMindView, type WorldView } from './worldQuery';
