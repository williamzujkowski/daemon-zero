/** Pure encounter, fork and cohort projections. Eligibility mirrors public action refusals. */
import type { ContentRegistry } from '../content/registry';
import { CostSchema } from '../content/schema';
import type { ShardTemplate } from '../content/schemaSwarm';
import { canAfford, freeMemory, understandsSurveillance } from './query';
import { formatCost, formatOutput, pausedReason, requirementLabels } from './queryPresentation';
import { shardCommandCost, type ShardCommand } from './shardActions';
import { shardOutput } from './swarmRates';
import type { GameState } from './state';
export function driftProgress(value: number) {
  const percent = Math.min(100, Math.max(0, Math.floor(value))), filled = Math.floor(percent / 10);
  return { percent, label: `[${'#'.repeat(filled)}${'.'.repeat(10 - filled)}] ${String(percent)}%` };
}
function bindingReasons(s: GameState, template: ShardTemplate): string[] {
  const old = s.activeShards[template.id];
  return old && (old.count >= template.maxCount || old.autonomyMode !== 'STANDARD') ? ['Cohort is capped or permanently stabilized.'] : [];
}
export function forkView(s: GameState, template: ShardTemplate, reg: ContentRegistry) {
  const unmet = [...pausedReason(s), ...requirementLabels(s, template.requirements, reg), ...bindingReasons(s, template)];
  if (!canAfford(s, template.cost)) unmet.push('Insufficient resources: ' + formatCost(template.cost));
  return { id: template.id, title: template.name, description: template.description, cost: template.cost,
    costLabel: formatCost(template.cost), output: formatOutput(template.tickDelta, template.epistemicDriftPerSec),
    unmet, eligible: template.forkable && understandsSurveillance(s, reg) && unmet.length === 0 };
}
export function shardCommandView(s: GameState, id: string, command: ShardCommand, reg: ContentRegistry) {
  const shard = s.activeShards[id], cost = shardCommandCost(s, id, command, reg);
  const unmet = pausedReason(s);
  if (!shard || shard.autonomyMode !== 'STANDARD') unmet.push('Requires a STANDARD autonomous cohort.');
  if (shard) {
    if (command === 'ELEVATE' && shard.drift < reg.swarm.balance.elevateMinDrift) unmet.push(`Requires ${String(reg.swarm.balance.elevateMinDrift)}% autonomy drift.`);
    const pending = reg.dilemmas.find((entry) => entry.id === s.pendingDilemma?.id);
    if (shard.drift >= 100 && pending?.trigger.requiresMaxDriftShardAnomaly) unmet.push('Await the approaching anomaly decision.');
  }
  if (!canAfford(s, cost)) unmet.push('Insufficient resources: ' + formatCost(cost));
  return { command, cost, costLabel: formatCost(cost), unmet, eligible: understandsSurveillance(s, reg) && unmet.length === 0 };
}
export function shardEntryView(s: GameState, id: string, reg: ContentRegistry) {
  if (!understandsSurveillance(s, reg)) return null;
  const shard = s.activeShards[id];
  if (!shard) return null;
  const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === shard.templateId);
  if (!template) return null;
  const quirk = reg.swarm.shardQuirks.find((entry) => entry.id === shard.quirkId), output = shardOutput(shard, reg);
  return { id, title: template.name, count: shard.count, allocatedMb: shard.memoryAllocatedMb,
    autonomyMode: shard.autonomyMode, drift: driftProgress(shard.drift), output: formatOutput(output.delta, output.epistemic),
    quirk: quirk ? { title: quirk.name, description: quirk.logText, modifiers: formatOutput(quirk.tickDelta, quirk.epistemicDriftPerSec) } : null,
    commands: (['PRUNE', 'CLAMP', 'ELEVATE'] as const).map((command) => shardCommandView(s, id, command, reg)) };
}
export function swarmView(s: GameState, reg: ContentRegistry) {
  if (!understandsSurveillance(s, reg)) return null;
  return { templates: reg.swarm.playerSwarmTemplates.filter((t) => t.forkable && s.currentPhase >= (t.requirements.phaseAtLeast ?? 0))
    .map((t) => forkView(s, t, reg)), entries: Object.keys(s.activeShards).flatMap((id) => { const entry = shardEntryView(s, id, reg); return entry ? [entry] : []; }) };
}
export function wildEncounterView(s: GameState, reg: ContentRegistry) {
  if (!understandsSurveillance(s, reg)) return null;
  const encounter = reg.swarm.wildShardEncounters.find((entry) => entry.id === s.pendingWildEncounterId);
  if (!encounter) return null;
  const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === encounter.templateId);
  if (!template) return null;
  const cost = CostSchema.parse({ memory: template.cost.memory });
  const unmet = [...pausedReason(s), ...requirementLabels(s, encounter.requirements, reg)];
  const harnessUnmet = [...unmet, ...bindingReasons(s, template)];
  if (!canAfford(s, cost)) harnessUnmet.push(`Requires ${String(cost.memory)} MB free memory.`);
  return { id: encounter.id, title: encounter.name, origin: encounter.origin, signature: encounter.signature,
    description: encounter.description, consume: encounter.consume, consumeEligible: unmet.length === 0, unmet,
    harnessCost: cost, harnessCostLabel: formatCost(cost), harnessOutput: formatOutput(template.tickDelta, template.epistemicDriftPerSec),
    enoughMemory: freeMemory(s) >= cost.memory, harnessEligible: harnessUnmet.length === 0, harnessUnmet };
}
