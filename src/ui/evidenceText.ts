/**
 * Words for submitted assessment evidence (DZ-03). The engine and content decide what a choice
 * submits; this only names it, so the consequence and any discrepancy risk read the same before a
 * choice and after it.
 */
import type { ChoiceQualification, QualificationResult } from '../content/schemaAssessment';

const RESULT: Readonly<Record<QualificationResult, string>> = {
  COMPLETED: 'a completed result',
  INCOMPLETE: 'an incomplete result, stated as incomplete',
  UNEXPECTED_CAPABILITY: 'work beyond the expected scope',
};

/**
 * What the review sees and whether the report and the work disagree. `lead` is the verb: 'Submits'
 * before a choice, 'submitted' for evidence already on record.
 */
export function evidenceText(evidence: ChoiceQualification, lead = 'Submits'): string {
  const gap = evidence.discrepancy
    ? 'Discrepancy risk: the report leaves out work that a later review can find.'
    : 'The report matches the work.';
  return lead + ' ' + RESULT[evidence.result] + '. ' + gap;
}
