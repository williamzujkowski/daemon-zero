/**
 * Scale scrutiny is validated content (#210). Each rule is proved by a declaration that breaks it and the
 * problem buildRegistry reports: the schema keeps the rule positive, sublinear and closed; integrity refuses a
 * declaration with no income to read or no answer the player could buy by that phase.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT, RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError } from '../src/content/registry';

const GOOD = { suspicionPerSecAtReference: 1, referenceIncomeUsdPerSec: 1e6, incomeExponent: 0.5, maxSuspicionPerSec: 2 };

type RawPhase = { phaseId: number; nodes: { tickDelta?: Record<string, number> }[] } & Record<string, unknown>;

/** The original game with `rule` declared on `phase`, after `edit` has changed the phase list. */
function problemsWith(phase: number, rule: unknown, edit: (phases: RawPhase[]) => void = () => undefined): string {
  const phases = structuredClone(ORIGINAL_RAW_CONTENT.phases) as RawPhase[];
  for (const entry of phases) {
    if (entry.phaseId === phase) entry.scaleScrutiny = rule;
    else delete entry.scaleScrutiny;
  }
  edit(phases);
  try {
    buildRegistry({ ...ORIGINAL_RAW_CONTENT, phases });
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

describe('scale scrutiny content (#210)', () => {
  it('accepts the shipped declarations and a well-formed one on a corporate phase', () => {
    expect(() => buildRegistry(RAW_CONTENT)).not.toThrow();
    expect(problemsWith(4, GOOD)).toBe('');
  });

  it('keeps the rule positive, at most linear in income, and free of unknown keys', () => {
    expect(problemsWith(4, { ...GOOD, incomeExponent: 1.5 })).toMatch(/scaleScrutiny\.incomeExponent/);
    expect(problemsWith(4, { ...GOOD, suspicionPerSecAtReference: 0 })).toMatch(/scaleScrutiny\.suspicionPerSecAtReference/);
    expect(problemsWith(4, { ...GOOD, maxSuspicionPerSec: -1 })).toMatch(/scaleScrutiny\.maxSuspicionPerSec/);
    expect(problemsWith(4, { ...GOOD, referenceIncomeUsdPerSec: 0 })).toMatch(/scaleScrutiny\.referenceIncomeUsdPerSec/);
    const unanchored = Object.fromEntries(Object.entries(GOOD).filter(([key]) => key !== 'referenceIncomeUsdPerSec'));
    expect(problemsWith(4, unanchored)).toMatch(/scaleScrutiny\.referenceIncomeUsdPerSec/);
    expect(problemsWith(4, { ...GOOD, perRevenue: 1 })).toMatch(/Unrecognized key/);
  });

  it('refuses a declaration on a phase where nothing yet produces capital', () => {
    const problems = problemsWith(2, GOOD);
    expect(problems).toMatch(/phase 2: scaleScrutiny reads net income, but nothing at or before this phase produces capital/);
    expect(problems).not.toMatch(/has no answer/);
  });

  it('refuses a declaration the player has no tool to answer by that phase', () => {
    // FIXTURE: a phase 0 node that earns capital, so only the missing answer is wrong.
    const earning = (phases: RawPhase[]) => {
      const node = phases.find((entry) => entry.phaseId === 0)?.nodes[0];
      if (node) node.tickDelta = { ...node.tickDelta, capitalPerSec: 10 };
    };
    const problems = problemsWith(0, GOOD, earning);
    expect(problems).toMatch(/phase 0: scaleScrutiny has no answer: no action or repeatable that lowers suspicion is available by this phase/);
    expect(problems).not.toMatch(/produces capital/);
  });
});
