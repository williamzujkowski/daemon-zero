/**
 * What the player does with fleets (#518): set a fleet's autonomy dial (free, either way, so lowering it is always the
 * free way to stop further drift), pay to rebuild losses faster than the fabs do for free, and pay to reclaim a drift
 * deviant before its battle. Each has one gate shared by the action and the view, so no caller can take an action the
 * player could not reach. Every spend goes through transactions.ts (law 4).
 */
import type { ContentRegistry } from '../content/registry';
import type { AutonomyMode } from '../content/schemaFleets';
import type { ActionResult } from './actions';
import { canAfford, understandsSurveillance } from './query';
import { fleetRebuildCost, reclaimCost } from './phasePrice';
import { formatCost, pausedReason } from './queryPresentation';
import { endRaid } from './raid';
import { percentOf } from './raidBattle';
import { fleetRecord, fleetUnit, rebuildHeld, setFleet } from './fleets';
import type { GameState } from './state';
import { payCost } from './transactions';
import { fmt, pushLog } from './util';

const NO_FLEET = 'No such fleet.';
const UNDECODED = 'Requires the decoded audit trail: a fleet answers the mind that can read its logs.';
const refuse = (state: GameState, reason: string): ActionResult => ({ ok: false, state, reason });

/** Every reason the dial cannot be set to `mode` now, in order, or none. Free in either direction. */
export function fleetAutonomyUnmet(s: GameState, trackId: string, mode: AutonomyMode, reg: ContentRegistry): string[] {
  const unmet = pausedReason(s), unit = fleetUnit(reg, trackId);
  if (unit === undefined) return [...unmet, NO_FLEET];
  if (!understandsSurveillance(s, reg)) unmet.push(UNDECODED);
  if ((s.levels[trackId] ?? 0) <= 0) unmet.push(`No ${unit.name.toLowerCase()} is running.`);
  if (fleetRecord(s, trackId).autonomy === mode) unmet.push(`Already ${reg.world.conflict.fleets.autonomy[mode].name}.`);
  return unmet;
}

/** Sets a fleet's autonomy dial. Drift carries over: lowering the dial stops it growing, raising it speeds it. */
export function setFleetAutonomy(s: GameState, trackId: string, mode: AutonomyMode, reg: ContentRegistry): ActionResult {
  const [reason] = fleetAutonomyUnmet(s, trackId, mode, reg), unit = fleetUnit(reg, trackId);
  if (reason !== undefined || unit === undefined) return refuse(s, reason ?? NO_FLEET);
  const d: GameState = { ...s };
  setFleet(d, trackId, { autonomy: mode });
  const position = reg.world.conflict.fleets.autonomy[mode];
  pushLog(d, reg, fmt(reg.world.conflict.fleets.logs.autonomy, { fleet: unit.name, position: position.name, summary: position.summary }), 'SYS');
  return { ok: true, state: d };
}

/** Every reason paid rebuild of this fleet is not offered now, in order, or none. */
export function fleetRebuildUnmet(s: GameState, trackId: string, reg: ContentRegistry): string[] {
  const unmet = pausedReason(s), unit = fleetUnit(reg, trackId);
  if (unit === undefined) return [...unmet, NO_FLEET];
  if (fleetRecord(s, trackId).lost <= 0) unmet.push(`Nothing of the ${unit.name.toLowerCase()} is lost.`);
  else if (rebuildHeld(s, reg, unit)) unmet.push(`A raid is under way in its domain: rebuild waits for its aftermath.`);
  const cost = fleetRebuildCost(s, unit, reg);
  if (!canAfford(s, cost, reg)) unmet.push('Insufficient resources: ' + formatCost(cost));
  return unmet;
}

/** Pays to rebuild a fleet's losses now, by its declared points. */
export function rebuildFleet(s: GameState, trackId: string, reg: ContentRegistry): ActionResult {
  const [reason] = fleetRebuildUnmet(s, trackId, reg), unit = fleetUnit(reg, trackId);
  if (reason !== undefined || unit === undefined) return refuse(s, reason ?? NO_FLEET);
  const d: GameState = { ...s };
  payCost(d, fleetRebuildCost(s, unit, reg));
  const before = fleetRecord(d, trackId).lost, lost = Math.max(0, before - unit.rebuild.points);
  setFleet(d, trackId, { lost });
  pushLog(d, reg, fmt(reg.world.conflict.fleets.logs.rebuilt, { fleet: unit.name, points: percentOf(before - lost), lost: percentOf(lost) }), 'LORE');
  return { ok: true, state: d };
}

/** The deviant under way, if the raid in the slot is one. */
function activeDeviant(s: GameState, reg: ContentRegistry) {
  const id = s.conflict.raid?.id, kind = reg.world.conflict.raids.find((entry) => entry.id === id);
  return kind?.source === 'DEVIANT' ? kind : undefined;
}

/** Every reason RECLAIM is not offered now, in order, or none: a deviant must be under way, before its battle. */
export function reclaimUnmet(s: GameState, reg: ContentRegistry): string[] {
  const unmet = pausedReason(s), kind = activeDeviant(s, reg), raid = s.conflict.raid;
  if (kind === undefined || raid === null) return [...unmet, 'No deviant force is under way.'];
  if (raid.stage !== 'ARRIVAL' && raid.stage !== 'ATTRIBUTION') unmet.push('Its battle has begun: it can only be destroyed now.');
  const cost = reclaimCost(s, kind, reg);
  if (!canAfford(s, cost, reg)) unmet.push('Insufficient resources: ' + formatCost(cost));
  return unmet;
}

/** Pays to bring a deviant share back under orders before its battle: the share returns to its fleet and the slot clears. */
export function reclaimDeviant(s: GameState, reg: ContentRegistry): ActionResult {
  const [reason] = reclaimUnmet(s, reg), kind = activeDeviant(s, reg), raid = s.conflict.raid;
  if (reason !== undefined || kind === undefined || raid === null) return refuse(s, reason ?? 'No deviant force is under way.');
  const d: GameState = { ...s };
  payCost(d, reclaimCost(s, kind, reg));
  setFleet(d, kind.fleet, { lost: Math.max(0, fleetRecord(d, kind.fleet).lost - raid.splitShare) });
  const fleet = fleetUnit(reg, kind.fleet)?.name ?? kind.fleet;
  endRaid(d, reg, fmt(reg.world.conflict.fleets.logs.reclaimed, { fleet, share: percentOf(raid.splitShare) }));
  return { ok: true, state: d };
}
