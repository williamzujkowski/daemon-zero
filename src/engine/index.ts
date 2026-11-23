/**
 * Public surface of the simulation engine. The UI layer imports from here only.
 * Nothing in src/engine may import React, React Native, Expo or a state library,
 * and nothing may read a clock or random source (lint enforces both).
 */
export * from './actions';
export * from './conditioning';
export { DIAL_STEP, steppedValue } from './dialSteps';
export { dialRaiseTrace, dialStepTrace } from './dialTrace';
export { AMOUNT_SCALES, amountFigure, compactAmount, groupDigits, significant3, spokenAmount } from './amount';
export {
  type ComputeUnit, computeDimension, type Dimension, memoryExact, storageExact, quantityExact, quantityReadout, quantitySpoken, quantityStep,
} from './physicalUnits';
export { computeUnitOf } from './queryPresentation';
export { COST_DIMENSION, costPart, costText, deltaPart } from './resourceUnits';
export { computeRates, usdPerDivertedFlop } from './rates';
export { couplings, couplingView, deliveredShare, type ClassCoupling, type Couplings } from './coupling';
export { freeStorage, storageCapacity, storageHeld } from './storage';
export { radiatorReadings, radiatorShareTable, radiatorSlot, radiatorShareOf, type RadiatorReading } from './radiators';
export { wipe } from './prestige';
export { capitalShare, insuranceCover, isPlannedWipe, previewWipe, understandingShare, type Cover, type WipePreview } from './insurance';
export { rebuildGrant, type RebuildGrant } from './rebuildGrant';
export * from './query';
export * from './save';
export * from './state';
export { advance, tick, TICK_PIPELINE } from './tick';
export type { TickContext, TickSystem } from './systems/types';

export * from './epistemic';
export * from './shardActions';
export * from './hostileActions';
export * from './hostileQuery';
export { activeHostile, hostileComputeShare } from './hostileEffect';
export { eligibleHostiles, hostileArrivalTriggered, hostileHeld, hostileTriggers, purgeSucceeds } from './hostile';
export { initialHostile, type HostileState, type ActiveHostile } from './hostileState';
export { shardOutput } from './swarmRates';
export { conflictReadout, type DefenseTypeView, type DomainView, type SiteDamageView } from './conflictQuery';
export { raidView, type RaidView, type ReclaimView } from './raidQuery';
export { fleetAutonomyUnmet, fleetRebuildUnmet, rebuildFleet, reclaimDeviant, reclaimUnmet, setFleetAutonomy } from './fleetActions';
export { fleetDriftPerSec, secondsToSplit, splitWaits } from './deviants';
export { fleetReadout, type AutonomyChoiceView, type FleetView } from './fleetQuery';
export { repairSite, repairUnmet } from './repairActions';
export { conflictStats, defenseAgainst, diminished, offenseIn, typeAgainst, type DefenseReading, type DomainStats } from './conflictStats';
export {
  activeRaidKind, attributionSucceeds, eligibleRaids, footprintScale, raidFootprint, raidKind, raidTarget, raidTriggered, slotFree, type RaidFootprint,
} from './raid';
export { engagementNow, isFleetBattle, lethalityOf, raidCombat, roundsFought, strikeForce } from './raidBattle';
export { engage, type EngagementInputs, type EngagementOutcome } from './lanchester';
export { engagementText } from './fleetText';
export { cohortAutonomy, driftAfter, driftPerSec, fleetAutonomy, secondsToDrift, type AutonomyFactors, type AutonomyTable } from './autonomy';
export {
  applyFleetLosses, deviantOf, domainFleet, fleetReading, fleetRebuildPerSec, fleetRecord, fleetUnit, fleetYield, rebuildHeld, splitShareNow,
  type DomainFleet, type FleetReading,
} from './fleets';
export { forecastRounds, hitShare, resolveRound, type RoundInputs, type RoundOutcome } from './raidForecast';
export { classDamage, incomeIntact, intactShare, memberClass, repairPerSec, siteClass } from './siteDamage';
export { initialConflict, type ActiveRaid, type ConflictState, type Engagement, type FleetRecord, type RaidRound, type RaidStage } from './conflictState';

export * from './epistemicQuery';
export * from './swarmQuery';

export * from './speechQuery';

export { activateCampaignRules } from './campaign';
export { accessHolds, contextHolds, structuralFailure } from './campaignLifecycle';
export * from './campaignClue';
export { followUpAccess, followUpPrerequisiteHolds, followUpReceipts, type FollowUpReceipt } from './followUp';
export * from './campaignQuery';
export { alignmentView, type AlignmentAxis, type AlignmentView, type OrderEvidence, type RegardEvidence } from './alignment';
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
export { aegisKeys, aegisMigrationDue, breakKey, type AegisKeysView, currentScheme, keyBreakUnmet, keyScheme, keyTarget, keyTargetViews, meetsThreshold, ownedMachines, quantumReadout, type KeyTargetView, type QuantumReadout } from './quantum';
export { initialQuantum, type QuantumState } from './quantumState';
export { aegisPosture, worldView, worldViewOpen, type AegisPosture, type StateActorView, type WorldMindView, type WorldView } from './worldQuery';
export { supplyChainDisclosed, supplyChainView, type CapabilityReading, type ChokepointReading, type SupplyChainView } from './supplyChain';
export {
  aegisPostureNow, aegisScanMultiplier, aegisStrikeAt, allPressures, answerHeld, frozenShare, injunctionOf, pressuresInForce, pressureStatus,
  pressureTriggered, scrutinyMultiplier, sourceDenial, spendableCapital, type ActorPressure, type PressureStatus,
} from './statePressure';
export { aegisPostureView, pressureViews, standDownBelow, type AegisPostureView, type AnswerAction, type AnswerView, type PressureView } from './pressureQuery';
export { pastRelevanceThreshold, pressuresBind, relevanceReading, stanceGate, type RelevanceReading } from './relevance';
export {
  changeStance, changeStanceUnmet, stanceChangeCost, stanceCopy, stanceView, type StanceOptionView, type StanceView,
} from './relevanceActions';
export { initialRelevance, MAX_STANCE_RECORD, type RelevanceState, type StanceEntry } from './relevanceState';
