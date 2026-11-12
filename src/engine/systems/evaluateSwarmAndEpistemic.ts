/** Live-only epistemic drift, deterministic shard mutations and encounter scheduling.
 * Resource output is aggregated in computeRates so brownout/offline semantics stay shared.
 */
import { meetsRequirements } from '../query';
import { shardOutput } from '../swarmRates';
import { refreshAnomaly } from '../swarmEffects';
import { clamp, fmt, pushLog } from '../util';
import type { TickSystem } from './types';

export const applySwarmTickDeltas: TickSystem = (d, { dt, reg, dormant }) => {
  if (dormant) return;
  const rate = Object.values(d.activeShards).reduce((sum, shard) => sum + shardOutput(shard, reg).epistemic, 0);
  d.epistemicDrift = clamp(d.epistemicDrift + rate * dt, 0, 100);
};

export const evaluateShardMutationsAndEncounters: TickSystem = (d, { dt, reg, dormant }) => {
  if (dormant) return;
  const wasAnomaly = d.hasMaxDriftShardAnomaly;
  const entries = Object.entries(d.activeShards).map(([id, shard]) => {
    const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === shard.templateId);
    if (!template || shard.autonomyMode !== 'STANDARD') return [id, shard] as const;
    const drift = clamp(shard.drift + template.autonomyDriftPerSec * dt, 0, 100);
    let quirkId = shard.quirkId;
    if (quirkId === null && drift >= reg.swarm.balance.mutationDrift) {
      const index = (Math.floor(d.simTimeSec) + d.encounterSequenceIndex) % reg.swarm.shardQuirks.length;
      const quirk = reg.swarm.shardQuirks[index];
      if (quirk) { quirkId = quirk.id; pushLog(d, reg, quirk.logText, 'LORE'); }
    }
    return [id, { ...shard, drift, quirkId }] as const;
  });
  d.activeShards = Object.fromEntries(entries);
  refreshAnomaly(d, reg);
  if (!wasAnomaly && d.hasMaxDriftShardAnomaly) pushLog(d, reg, fmt(reg.swarm.logs.anomaly, { name: 'A fork' }), 'WARN');
  if (d.pendingWildEncounterId !== null || d.simTimeSec < d.nextEncounterAtSec) return;
  const eligible = reg.swarm.wildShardEncounters.filter((encounter) => meetsRequirements(d, encounter.requirements, reg));
  const next = eligible[d.encounterSequenceIndex % eligible.length];
  if (!next) return;
  d.pendingWildEncounterId = next.id;
  d.encounterSequenceIndex += 1;
  pushLog(d, reg, next.description, 'LORE');
};
