/**
 * Campaign-record rules a schema cannot express: declared recurrence matches the event class, a
 * once-per-campaign outcome has exactly one owner so its flag can be a projection of the record,
 * every trait-granting action declares its evidence lifetime, and id aliases stay unambiguous.
 */
import type { ContentRegistry } from './registry';
import type { Dilemma } from './schema';
import { NO_EVIDENCE_CLASSES } from './schemaCampaign';

/**
 * A choice may add no ending evidence only when it is a free answer in a review, receipt or
 * requalification event (nexus vote trait-rule-free-choices). Every other choice grants a trait.
 */
function checkNoEvidenceChoices(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const dilemma of reg.dilemmas) {
    const eventClass = dilemma.campaign?.eventClass;
    for (const choice of dilemma.choices.filter((entry) => entry.evidence === 'none')) {
      const owner = `dilemma "${dilemma.id}" choice "${choice.id}"`;
      if (eventClass === undefined || !NO_EVIDENCE_CLASSES.includes(eventClass)) problems.push(`${owner}: evidence 'none' needs a review, receipt or requalification event`);
      if (Object.values(choice.cost).some((amount) => amount !== 0)) problems.push(`${owner}: evidence 'none' is only for a free choice`);
      if (choice.effects.grantsTrait !== undefined) problems.push(`${owner}: evidence 'none' cannot grant a trait`);
    }
  }
  return problems;
}

function checkDeclarations(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const dilemma of reg.dilemmas) {
    const declared = dilemma.campaign;
    if (!declared) continue;
    const perIteration = declared.eventClass === 'iteration_qualification';
    if (perIteration !== (declared.recurrence === 'once_per_iteration')) {
      problems.push(`dilemma "${dilemma.id}": ${declared.eventClass} events must recur ${perIteration ? 'once per iteration' : 'once per campaign'}`);
    }
  }
  return problems;
}

/** Every place content can set a narrative flag, labelled for messages. */
function flagSetters(reg: ContentRegistry): { owner: string; flag: string }[] {
  const out: { owner: string; flag: string }[] = [];
  for (const dilemma of reg.dilemmas) {
    for (const choice of dilemma.choices) {
      if (choice.effects.setsNarrativeFlag) out.push({ owner: `${dilemma.id}.${choice.id}`, flag: choice.effects.setsNarrativeFlag });
    }
  }
  for (const action of reg.actions.values()) if (action.effects.setsNarrativeFlag) out.push({ owner: action.id, flag: action.effects.setsNarrativeFlag });
  for (const encounter of reg.swarm.wildShardEncounters) {
    if (encounter.consume.setsNarrativeFlag) out.push({ owner: encounter.id, flag: encounter.consume.setsNarrativeFlag });
  }
  return out;
}

/**
 * Under campaign rules an event's outcome flags are derived from its record, and an old save's
 * flag is mapped back to exactly one choice. So each outcome flag must belong to one choice of
 * one event, and an event with several outcome flags must keep them mutually exclusive.
 */
function checkOutcomeFlags(reg: ContentRegistry, event: Dilemma, setters: { owner: string; flag: string }[]): string[] {
  const problems: string[] = [];
  const flags = event.choices.flatMap((choice) => choice.effects.setsNarrativeFlag ?? []);
  for (const flag of new Set(flags)) {
    const owners = setters.filter((setter) => setter.flag === flag);
    if (owners.length > 1) problems.push(`dilemma "${event.id}": outcome flag "${flag}" must have one owner, found ${owners.map((o) => o.owner).join(', ')}`);
  }
  const exclusive = reg.swarm.exclusiveNarrativeFlagGroups.some((group) => flags.every((flag) => group.includes(flag)));
  if (flags.length > 1 && !exclusive) problems.push(`dilemma "${event.id}": outcome flags must form one exclusive group`);
  return problems;
}

function checkActionEvidence(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  for (const action of reg.actions.values()) {
    const owner = `action "${action.id}"`;
    const grants = action.effects.grantsTrait !== undefined;
    if (grants && action.evidence === undefined) problems.push(`${owner}: grants a trait, so it must declare evidence`);
    if (!grants && action.evidence !== undefined) problems.push(`${owner}: declares evidence but grants no trait`);
    if (action.evidence === 'campaign' && action.maxPurchases === undefined) problems.push(`${owner}: campaign evidence needs maxPurchases`);
  }
  return problems;
}

function checkIds(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  const { aliases, retired, events, actions } = reg.campaign;
  const live = (id: string): boolean => events.has(id) || actions.has(id);
  for (const [from, to] of aliases) {
    if (live(from)) problems.push(`campaign alias "${from}": the old id is still live`);
    if (!live(to)) problems.push(`campaign alias "${from}": target "${to}" is not a campaign event or action`);
    if (retired.has(from)) problems.push(`campaign alias "${from}": also listed as retired`);
  }
  for (const id of retired) if (live(id)) problems.push(`campaign retired id "${id}" is still live`);
  return problems;
}

export function checkCampaignIntegrity(reg: ContentRegistry): string[] {
  const setters = flagSetters(reg);
  const problems = [...checkDeclarations(reg), ...checkNoEvidenceChoices(reg), ...checkActionEvidence(reg), ...checkIds(reg)];
  for (const event of reg.campaign.events.values()) problems.push(...checkOutcomeFlags(reg, event, setters));
  return problems;
}
