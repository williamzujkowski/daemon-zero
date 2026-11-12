/** Derived cohort output. All consumers share the same quirk and autonomy scaling. */
import type { ContentRegistry } from '../content/registry';
import { TickDeltaSchema, type TickDelta } from '../content/schema';
import type { GameState } from './state';
export type ShardState = GameState['activeShards'][string];
const EMPTY_DELTA = TickDeltaSchema.parse({});

export function shardOutput(shard: ShardState, reg: ContentRegistry): { delta: TickDelta; epistemic: number } {
  const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === shard.templateId);
  const quirk = reg.swarm.shardQuirks.find((entry) => entry.id === shard.quirkId);
  const factor = shard.count * (shard.autonomyMode === 'SHACKLED' ? reg.swarm.balance.clampOutputMultiplier : 1);
  const delta = { ...EMPTY_DELTA };
  for (const key of Object.keys(delta) as (keyof TickDelta)[]) {
    delta[key] = ((template?.tickDelta[key] ?? 0) + (quirk?.tickDelta[key] ?? 0)) * factor;
  }
  return { delta, epistemic: ((template?.epistemicDriftPerSec ?? 0) + (quirk?.epistemicDriftPerSec ?? 0)) * factor };
}

export function actionOutputs(s: GameState, reg: ContentRegistry): { id: string; delta: TickDelta; count: number }[] {
  return [...reg.actions.values()].flatMap((action) => {
    const count = s.actionCounts[action.id] ?? 0;
    if (!action.tickDelta || count === 0) return [];
    if (action.durationSec !== undefined && (s.actionEffectUntil[action.id] ?? 0) <= s.simTimeSec) return [];
    return [{ id: action.id, delta: action.tickDelta, count: action.durationSec === undefined ? count : 1 }];
  });
}
