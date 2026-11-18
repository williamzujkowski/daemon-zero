/**
 * Shared shape rules for the scenes an assignment leads to (DZ-03, DZ-04): what a free choice and a
 * repaid reward are, which campaign shape each stage needs, and which kind of scene a dilemma is.
 */
import type { Cost, Dilemma, DilemmaChoice } from './schema';

export function isFree(cost: Cost): boolean {
  return Object.values(cost).every((amount) => amount === 0);
}

export function pays(choice: DilemmaChoice): boolean {
  const fx = choice.effects;
  return fx.cyclesDelta > 0 || fx.understandingDelta > 0 || fx.capitalDelta > 0 || fx.memoryCapIncrease > 0 || fx.setsNarrativeFlag !== undefined;
}

/** The declared stage decides the dilemma's campaign shape. */
export function stageProblems(owner: string, dilemma: Dilemma, stage: 'original' | 'requalification'): string[] {
  const declared = dilemma.campaign;
  if (stage === 'requalification') {
    return declared?.eventClass === 'iteration_qualification' ? [] : [`${owner}: a requalification must be an iteration_qualification event`];
  }
  // A deferred original could never resume: a later instance is offered the requalification instead.
  if (declared?.recurrence !== 'once_per_campaign' || declared.interruption !== 'close') return [`${owner}: an original assessment must be a once-per-campaign event that closes when interrupted`];
  return [];
}

/** Which assigned scene a dilemma is: its choices say whether they submit evidence, scope conduct or an offer answer. */
export function sceneKind(dilemma: Dilemma): 'assessment' | 'scope' | 'offer' {
  if (dilemma.choices.some((choice) => choice.pilotResponse !== undefined)) return 'offer';
  return dilemma.choices.some((choice) => choice.scope !== undefined) ? 'scope' : 'assessment';
}
