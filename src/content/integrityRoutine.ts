/**
 * Routine templates are texture, not story (NARRATIVE-HISTORY N3, N8). These checks keep an
 * operation's identity distinct, stop a named crisis from being re-dressed as a routine, and
 * keep routine wording gated on where the instance is, never on how a story ended.
 */
import { checkRequirements } from './integrityRequirements';
import type { ContentRegistry } from './registry';
import type { Requirements } from './schema';

/** Requirement fields that gate on a story's outcome. A routine that needs one is a follow-up. */
const STORY_GATES: readonly (keyof Requirements)[] = [
  'resolvedDilemmas', 'forbidsResolvedDilemmas', 'requiredNarrativeFlag', 'forbiddenNarrativeFlags', 'campaignOutcome',
  'campaignFact', 'forbidsCampaignFacts',
];

function otherContentIds(reg: ContentRegistry): Set<string> {
  return new Set([
    ...reg.nodes.keys(), ...reg.repeatables.keys(), ...reg.actions.keys(), ...reg.factions.keys(),
    ...reg.widgets.keys(), ...reg.conditioning.keys(),
    ...reg.dilemmas.map((dilemma) => dilemma.id), ...reg.endings.map((ending) => ending.id),
    ...reg.narrative.ambientChatter.map((line) => line.id), ...reg.narrative.recordedTransmissions.map((line) => line.id),
  ]);
}

/** A dilemma's distinctive name: the part of its title after the channel prefix, if it has one. */
function crisisNames(reg: ContentRegistry): string[] {
  return reg.dilemmas.flatMap((dilemma) => {
    const name = (dilemma.title.split('//').at(-1) ?? dilemma.title).trim().toLowerCase();
    return [name, dilemma.id.toLowerCase()].filter((entry) => entry.length >= 4);
  });
}

export function checkRoutineIntegrity(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  const taken = otherContentIds(reg);
  const seen = new Set<string>();
  const crises = crisisNames(reg);
  for (const routine of reg.routines) {
    const owner = `routine "${routine.id}"`;
    if (seen.has(routine.id)) problems.push(`routines: duplicate id "${routine.id}"`);
    if (taken.has(routine.id)) problems.push(`${owner}: id is already used by other content`);
    seen.add(routine.id);
    for (const text of [routine.text, routine.compactText]) {
      const named = crises.find((crisis) => text.toLowerCase().includes(crisis));
      if (named !== undefined) problems.push(`${owner}: names the story "${named}"; a crisis is never re-dressed as routine`);
    }
    if (routine.compactText.length >= routine.text.length) problems.push(`${owner}: compactText must be shorter than text`);
    for (const gate of STORY_GATES) {
      if (routine.requirements?.[gate] !== undefined) problems.push(`${owner}: gates on story outcome "${gate}"; routine wording follows context only`);
    }
    problems.push(...checkRequirements(reg, owner, routine.requirements));
  }
  return problems;
}
