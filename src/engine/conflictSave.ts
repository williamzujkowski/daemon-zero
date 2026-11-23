/**
 * Loading the conflict record (#517, #518): a save is untrusted input, so a raid content no longer declares, a target that
 * is no longer a site class, a log longer than the battle, a raid sharing the slot with a hostile mind, an engagement on a
 * raid that is no fleet battle, or a split share on a raid that is no deviant is dropped; damage is kept only for classes
 * content declares and fleet records only for fleets it declares, never past either cap.
 */
import type { ContentRegistry } from '../content/registry';
import type { RaidKind } from '../content/schemaConflict';
import type { ActiveRaid } from './conflictState';
import { isFleetBattle, roundsFought } from './raidBattle';
import type { GameState } from './state';

type RawSave = Record<string, unknown>;
const isRecord = (value: unknown): value is RawSave => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * v25 (#518): no earlier build had fleets, so every fleet is SUPERVISED with no drift and nothing lost, and a raid under
 * way is a rival's, with no engagement fought and no split share. Self-contained, so it can be renumbered past another step.
 */
export function migrateFleets(save: RawSave): RawSave {
  if (!isRecord(save.conflict)) return save;
  const raid = save.conflict.raid;
  return { ...save, conflict: { ...save.conflict, raid: isRecord(raid) ? { ...raid, engagement: null, splitShare: 0 } : raid, fleets: {} } };
}

/** Whether a raid in a save is one content can still run: a declared kind and target, and a record its kind can carry. */
function raidHolds(raid: ActiveRaid, kind: RaidKind | undefined, classes: ReadonlySet<string>, reg: ContentRegistry): boolean {
  const { raid: balance, fleets } = reg.world.conflict;
  if (kind === undefined || !classes.has(raid.target) || roundsFought(raid) > balance.rounds) return false;
  if (raid.engagement !== null && !isFleetBattle(kind)) return false;
  return kind.source === 'DEVIANT' ? raid.splitShare > 0 && raid.splitShare <= fleets.lossCap : raid.splitShare === 0;
}

export function reconcileConflict(s: GameState, reg: ContentRegistry): GameState {
  const { raids, siteClasses, raid: balance, fleets: fleetBalance } = reg.world.conflict;
  const classes = new Set(siteClasses.map((cls) => cls.id));
  const damage: Record<string, number> = {};
  for (const [id, value] of Object.entries(s.conflict.damage)) if (classes.has(id) && value > 0) damage[id] = Math.min(value, balance.damageCap);
  const fleets: GameState['conflict']['fleets'] = {};
  for (const [id, record] of Object.entries(s.conflict.fleets)) {
    if (fleetBalance.units.some((unit) => unit.repeatable === id)) fleets[id] = { ...record, lost: Math.min(record.lost, fleetBalance.lossCap) };
  }
  const raid = s.conflict.raid;
  const kept = raid !== null && s.hostile.active === null && raidHolds(raid, raids.find((kind) => kind.id === raid.id), classes, reg) ? raid : null;
  return { ...s, conflict: { ...s.conflict, raid: kept, damage, fleets } };
}
