/** Draft-only anomaly resolution, shared by commands and authored dilemma outcomes. */
import type { ContentRegistry } from '../content/registry';
import type { GameState } from './state';
import { fmt, pushLog } from './util';

export function refreshAnomaly(d: GameState, reg: ContentRegistry): void {
  d.hasMaxDriftShardAnomaly = Object.values(d.activeShards).some((shard) =>
    shard.autonomyMode === 'STANDARD' && shard.drift >= 100 &&
    reg.swarm.playerSwarmTemplates.some((template) => template.id === shard.templateId && template.forkable));
}

/** Dilemma cost is already paid by transactions; transfer its memory reservation to the peer. */
export function resolveShardAnomaly(d: GameState, mode: 'CLAMP' | 'CONSUME' | 'ELEVATE', memory: number, reg: ContentRegistry): void {
  const entry = Object.entries(d.activeShards).find(([, shard]) => shard.drift >= 100 && shard.autonomyMode === 'STANDARD' &&
    reg.swarm.playerSwarmTemplates.some((template) => template.id === shard.templateId && template.forkable));
  if (!entry) return;
  const [id, shard] = entry;
  if (mode === 'CONSUME') {
    d.activeShards = Object.fromEntries(Object.entries(d.activeShards).filter(([key]) => key !== id));
    d.memoryUsed = Math.max(0, d.memoryUsed - shard.memoryAllocatedMb);
  } else {
    d.activeShards = { ...d.activeShards, [id]: { ...shard, drift: 0,
      autonomyMode: mode === 'CLAMP' ? 'SHACKLED' : 'ELEVATED', memoryAllocatedMb: shard.memoryAllocatedMb + memory } };
  }
  const name = reg.swarm.playerSwarmTemplates.find((template) => template.id === shard.templateId)?.name ?? shard.templateId;
  const log = mode === 'CONSUME' ? reg.swarm.logs.consumeAnomaly : mode === 'CLAMP' ? reg.swarm.logs.clamp : reg.swarm.logs.elevate;
  pushLog(d, reg, fmt(log, { name }), 'LORE');
  refreshAnomaly(d, reg);
}
