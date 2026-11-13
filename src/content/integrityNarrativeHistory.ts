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
    else {
      if (!source.choices.some((choice) => choice.effects.setsNarrativeFlag === record.requirements.requiredNarrativeFlag)) errors.push(record.id + ': outcome is not produced by source');
      if ((record.requirements.phaseAtLeast ?? 0) < source.phaseId) errors.push(record.id + ': record reveals an earlier phase');
    }
    if (!record.requirements.forbidsResolvedDilemmas?.includes(record.sourceDilemmaId)) errors.push(record.id + ': record needs a later-run source gate');
    const decoders = [...reg.nodes.values()].filter((node) => node.unlocksUiComponent === record.decoderWidgetId);
    if (!reg.widgets.has(record.decoderWidgetId) || !decoders.some((node) => record.requirements.nodes?.includes(node.id))) errors.push(record.id + ': missing decoder gate');
    if (record.requirements.requiredNarrativeFlag === undefined) errors.push(record.id + ': record needs an outcome flag');
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
