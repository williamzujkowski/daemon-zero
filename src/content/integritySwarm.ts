/** Cross-manifest checks for narrative flags, action caps and cohort references. */
import type { ContentRegistry } from './registry';
import type { EffectPayload, Requirements } from './schema';

function refs(req: Requirements, fx: EffectPayload | undefined, flags: Set<string>, owner: string): string[] {
  const used = [req.requiredNarrativeFlag, ...(req.forbiddenNarrativeFlags ?? []), fx?.setsNarrativeFlag];
  return used.filter((flag) => flag !== undefined && !flags.has(flag)).map((flag) => `${owner}: unknown narrative flag ${String(flag)}`);
}
function duplicates(ids: string[], owner: string): string[] {
  return new Set(ids).size === ids.length ? [] : [`${owner}: duplicate id`];
}

export function checkSwarmIntegrity(reg: ContentRegistry): string[] {
  const swarm = reg.swarm;
  const flags = new Set(swarm.narrativeFlags);
  const problems = duplicates(swarm.narrativeFlags, 'narrative flags');
  for (const [name, items] of Object.entries({ templates: swarm.playerSwarmTemplates, encounters: swarm.wildShardEncounters, quirks: swarm.shardQuirks })) {
    problems.push(...duplicates(items.map((item) => item.id), name));
  }
  for (const encounter of swarm.wildShardEncounters) {
    if (!swarm.playerSwarmTemplates.some((template) => template.id === encounter.templateId)) problems.push(`${encounter.id}: unknown shard template`);
    problems.push(...refs(encounter.requirements, encounter.consume, flags, encounter.id));
  }
  for (const template of swarm.playerSwarmTemplates) problems.push(...refs(template.requirements, undefined, flags, template.id));
  for (const ending of reg.endings) problems.push(...refs(ending.requirements ?? {}, undefined, flags, ending.id));
  for (const node of reg.nodes.values()) problems.push(...refs(node.requirements ?? {}, undefined, flags, node.id));
  for (const rep of reg.repeatables.values()) problems.push(...refs(rep.requirements, undefined, flags, rep.id));
  for (const action of reg.actions.values()) {
    problems.push(...refs(action.requirements, action.effects, flags, action.id));
    for (const id of action.exclusiveWith ?? []) {
      if (!reg.actions.has(id) || id === action.id || !reg.actions.get(id)?.exclusiveWith?.includes(action.id)) problems.push(`${action.id}: exclusiveWith must name a reciprocal action`);
    }
    if (action.durationSec !== undefined && !action.tickDelta) problems.push(`${action.id}: duration requires tickDelta`);
    if (action.effects.removesOldestConditioningMark && (!action.requirements.requiresActiveConditioningMark || action.conditioningDiscount === undefined)) problems.push(`${action.id}: mark removal requires a mark gate and discounted price`);
    if (action.conditioningDiscount !== undefined && !action.effects.removesOldestConditioningMark) problems.push(`${action.id}: discount requires mark removal`);
  }
  for (const dilemma of reg.dilemmas) for (const choice of dilemma.choices) {
    problems.push(...refs(dilemma.trigger, choice.effects, flags, dilemma.id));
    if (choice.effects.resolvesShardAnomaly && !dilemma.trigger.requiresMaxDriftShardAnomaly) problems.push(`${dilemma.id}: anomaly choice needs anomaly trigger`);
  }
  return problems;
}
