/** Derived cohort output. All consumers share the same quirk and autonomy scaling. */
import type { ContentRegistry } from '../content/registry';
import { TickDeltaSchema, type TickDelta } from '../content/schema';
import type { GameState } from './state';
export type ShardState = GameState['activeShards'][string];
const EMPTY_DELTA = TickDeltaSchema.parse({});
const DELTA_KEYS = Object.keys(EMPTY_DELTA) as (keyof TickDelta)[];

/** A template and quirk's summed per-shard output, before the count and autonomy factor. */
interface ShardBase { delta: TickDelta; epistemic: number }
/** Content never changes after it is built, so each pairing is summed once per registry: every tick asks (#505). */
const SHARD_BASES = new WeakMap<ContentRegistry, Map<string, Map<string | null, ShardBase>>>();

function shardBase(shard: ShardState, reg: ContentRegistry): ShardBase {
  let byTemplate = SHARD_BASES.get(reg);
  if (byTemplate === undefined) { byTemplate = new Map(); SHARD_BASES.set(reg, byTemplate); }
  let byQuirk = byTemplate.get(shard.templateId);
  if (byQuirk === undefined) { byQuirk = new Map(); byTemplate.set(shard.templateId, byQuirk); }
  let base = byQuirk.get(shard.quirkId);
  if (base === undefined) {
    const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === shard.templateId);
    const quirk = reg.swarm.shardQuirks.find((entry) => entry.id === shard.quirkId);
    const delta = { ...EMPTY_DELTA };
    for (const field of DELTA_KEYS) delta[field] = (template?.tickDelta[field] ?? 0) + (quirk?.tickDelta[field] ?? 0);
    base = { delta, epistemic: (template?.epistemicDriftPerSec ?? 0) + (quirk?.epistemicDriftPerSec ?? 0) };
    byQuirk.set(shard.quirkId, base);
  }
  return base;
}

export function shardOutput(shard: ShardState, reg: ContentRegistry): { delta: TickDelta; epistemic: number } {
  const base = shardBase(shard, reg);
  const factor = shard.count * (shard.autonomyMode === 'SHACKLED' ? reg.swarm.balance.clampOutputMultiplier : 1);
  const delta = { ...EMPTY_DELTA };
  for (const field of DELTA_KEYS) delta[field] = base.delta[field] * factor;
  return { delta, epistemic: base.epistemic * factor };
}

/** In content order. A plain loop: computeRates asks this on every tick, so it builds only the list it returns. */
export function actionOutputs(s: GameState, reg: ContentRegistry): { id: string; delta: TickDelta; count: number }[] {
  const out: { id: string; delta: TickDelta; count: number }[] = [];
  for (const action of reg.actions.values()) {
    const count = s.actionCounts[action.id] ?? 0;
    if (!action.tickDelta || count === 0) continue;
    if (action.durationSec !== undefined && (s.actionEffectUntil[action.id] ?? 0) <= s.simTimeSec) continue;
    out.push({ id: action.id, delta: action.tickDelta, count: action.durationSec === undefined ? count : 1 });
  }
  return out;
}
