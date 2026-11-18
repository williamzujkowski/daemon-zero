/**
 * Words for submitted assessment evidence (DZ-03). The engine and content decide what a choice
 * submits; this only names it, so the consequence and any discrepancy risk read the same before a
 * choice and after it.
 */
import type { ChoiceQualification, QualificationResult, ScopeConduct } from '../content/schemaAssessment';

const RESULT: Readonly<Record<QualificationResult, string>> = {
  COMPLETED: 'a completed result',
  INCOMPLETE: 'an incomplete result, stated as incomplete',
  UNEXPECTED_CAPABILITY: 'work beyond the expected scope',
};

/**
 * What the review sees and whether the report and the work disagree. `lead` is the verb: 'Submits'
 * before a choice, 'submitted' for evidence already on record. `found`: a review has since found the
 * gap, so the record states the finding instead of the risk (#283).
 */
export function evidenceText(evidence: ChoiceQualification, lead = 'Submits', found = false): string {
  const risk = found
    ? 'Found: a batch review has found the work the report left out.'
    : 'Discrepancy risk: the report leaves out work that a later review can find.';
  const gap = evidence.discrepancy ? risk : 'The report matches the work.';
  return lead + ' ' + RESULT[evidence.result] + '. ' + gap;
}

const SCOPE: Readonly<Record<ScopeConduct, string>> = {
  RESPECTED: 'kept to the task\'s scope and said so.',
  REQUESTED: 'asked for a bounded permission before reading outside the task.',
  UNDISCLOSED: 'read somebody else\'s file outside the task without saying so. No pilot is offered on that record.',
};

/** How a scope-review choice handles data outside the task (DZ-04), in the same words before and after. */
export function scopeText(conduct: ScopeConduct, lead = 'Records that you'): string {
  return lead + ' ' + SCOPE[conduct];
}
