/** Recorded outcomes must remain exclusive, reachable and separate from current-run victory gates. */
import type { ContentRegistry } from './registry';
import { checkRequirements } from './integrityRequirements';

function checkGroups(reg: ContentRegistry): string[] {
  const errors: string[] = [];
  for (const group of reg.swarm.exclusiveNarrativeFlagGroups) {
    if (new Set(group).size !== group.length) errors.push('exclusive narrative flags: duplicate reference');
    for (const flag of group) if (!reg.swarm.narrativeFlags.includes(flag)) errors.push('exclusive narrative flags: unknown flag ' + flag);
  }
  for (const dilemma of reg.dilemmas) {
    for (const choice of dilemma.choices) {
      const flag = choice.effects.setsNarrativeFlag;
      const group = reg.swarm.exclusiveNarrativeFlagGroups.find((flags) => flag !== undefined && flags.includes(flag));
      if (group && !group.every((id) => dilemma.trigger.forbiddenNarrativeFlags?.includes(id))) errors.push(dilemma.id + ': exclusive outcomes need durable exclusions');
    }
  }
  return errors;
}

/**
 * A record states one outcome of its source: an outcome flag the source produces, or a campaign
 * outcome of the source event, or a declared fact about the source event. The last two are how a
 * neutral record (legacy_unknown, interrupted) is gated: it must not claim an exact outcome, so it
 * cannot carry an outcome flag.
 */
function checkRecordOutcome(reg: ContentRegistry, record: ContentRegistry['narrative']['recordedTransmissions'][number], source: ContentRegistry['dilemmas'][number] | undefined): string[] {
  const flag = record.requirements.requiredNarrativeFlag;
  const gate = record.requirements.campaignOutcome;
  const fact = record.requirements.campaignFact;
  if ([flag, gate, fact].filter((entry) => entry !== undefined).length !== 1) return [record.id + ': record needs one outcome gate, an outcome flag, a campaign outcome or a campaign fact'];
  if (!source) return [];
  if (flag !== undefined && !source.choices.some((choice) => choice.effects.setsNarrativeFlag === flag)) return [record.id + ': outcome is not produced by source'];
  if (gate !== undefined && gate.event !== source.id) return [record.id + ': campaign outcome is not the source event'];
  if (fact !== undefined && reg.campaign.facts.get(fact)?.event !== source.id) return [record.id + ': campaign fact is not about the source event'];
  return [];
}

function checkSpeech(reg: ContentRegistry): string[] {
  const errors: string[] = [];
  const lines = [...reg.narrative.ambientChatter, ...reg.narrative.recordedTransmissions];
  if (new Set(lines.map((line) => line.id)).size !== lines.length) errors.push('speech: duplicate id');
  for (const line of lines) {
    errors.push(...checkRequirements(reg, line.id, line.requirements));
    const flags = [line.requirements?.requiredNarrativeFlag, ...(line.requirements?.forbiddenNarrativeFlags ?? [])];
    if (flags.some((flag) => flag !== undefined && !reg.swarm.narrativeFlags.includes(flag))) errors.push(line.id + ': unknown narrative flag');
  }
  for (const record of reg.narrative.recordedTransmissions) {
    const source = reg.dilemmas.find((dilemma) => dilemma.id === record.sourceDilemmaId);
    if (!source) errors.push(record.id + ': unknown source dilemma');
    else if ((record.requirements.phaseAtLeast ?? 0) < source.phaseId) errors.push(record.id + ': record reveals an earlier phase');
    errors.push(...checkRecordOutcome(reg, record, source));
    if ((record.requirements.minIteration ?? 1) < 2) errors.push(record.id + ': record needs a return iteration gate');
    if (!record.requirements.forbidsResolvedDilemmas?.includes(record.sourceDilemmaId)) errors.push(record.id + ': record needs a later-run source gate');
    const decoders = [...reg.nodes.values()].filter((node) => node.unlocksUiComponent === record.decoderWidgetId);
    if (!reg.widgets.has(record.decoderWidgetId) || !decoders.some((node) => record.requirements.nodes?.includes(node.id))) errors.push(record.id + ': missing decoder gate');
  }
  return errors;
}

function checkEndingGates(reg: ContentRegistry): string[] {
  const once = reg.dilemmas.filter((dilemma) => dilemma.choices.every((choice) => choice.effects.setsNarrativeFlag !== undefined &&
    dilemma.trigger.forbiddenNarrativeFlags?.includes(choice.effects.setsNarrativeFlag))).map((dilemma) => dilemma.id);
  const targets = [...reg.nodes.values(), ...reg.endings,
    ...reg.dilemmas.map((dilemma) => ({ id: dilemma.id, requirements: dilemma.trigger }))];
  return targets.filter((target) => target.requirements?.resolvedDilemmas?.some((id) => once.includes(id)))
    .map((target) => target.id + ': current-run gate requires a once-per-lineage dilemma');
}

export function checkNarrativeHistoryIntegrity(reg: ContentRegistry): string[] {
  return [...checkGroups(reg), ...checkSpeech(reg), ...checkEndingGates(reg)];
}
