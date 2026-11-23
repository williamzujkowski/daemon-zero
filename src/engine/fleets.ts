/**
 * Fleets (#518, docs/SCALE.md "Round 5"): the robot and drone tracks data/conflict.json declares as fleets. A fleet's
 * full strength is its running levels times its strength a level times the autonomy dial's output; battle and splits
 * take a share of it as losses, never past the lossCap, and the fabs rebuild them. Every reader (the rates, the stats,
 * a battle, the readout) takes a fleet's strength from here, so none can disagree. Pure.
 */
import type { ContentRegistry } from '../content/registry';
import type { DeviantRaid } from '../content/schemaConflict';
import type { FleetUnit } from '../content/schemaFleets';
import { fleetAutonomy } from './autonomy';
import type { FleetRecord } from './conflictState';
import { nodeOutputScaleIn, useScope } from './grantQuery';
import type { GameState } from './state';

interface FleetIndex {
  byTrack: ReadonlyMap<string, FleetUnit>;
  /** The deviant kind each fleet splits into, by track. */
  deviantOf: ReadonlyMap<string, DeviantRaid>;
}

const INDEX = new WeakMap<ContentRegistry, FleetIndex>();

function fleetIndex(reg: ContentRegistry): FleetIndex {
  let found = INDEX.get(reg);
  if (found === undefined) {
    const deviantOf = new Map<string, DeviantRaid>();
    for (const kind of reg.world.conflict.raids) if (kind.source === 'DEVIANT') deviantOf.set(kind.fleet, kind);
    found = { byTrack: new Map(reg.world.conflict.fleets.units.map((unit) => [unit.repeatable, unit])), deviantOf };
    INDEX.set(reg, found);
  }
  return found;
}

/** Whether no fleet has a level running: the drift stage asks on every tick, so this allocates nothing. */
export function noFleetRuns(s: Pick<GameState, 'levels'>, reg: ContentRegistry): boolean {
  for (const unit of reg.world.conflict.fleets.units) if ((s.levels[unit.repeatable] ?? 0) > 0) return false;
  return true;
}

/** The fleet a track is, if it is one. */
export function fleetUnit(reg: ContentRegistry, trackId: string): FleetUnit | undefined {
  return fleetIndex(reg).byTrack.get(trackId);
}

/** The deviant kind a fleet splits into. */
export function deviantOf(reg: ContentRegistry, trackId: string): DeviantRaid | undefined {
  return fleetIndex(reg).deviantOf.get(trackId);
}

const NEW_FLEET: FleetRecord = { autonomy: 'STANDARD', drift: 0, lost: 0 };

/** A fleet's record: SUPERVISED, no drift and nothing lost until something changes it. */
export function fleetRecord(s: Pick<GameState, 'conflict'>, trackId: string): FleetRecord {
  return s.conflict.fleets[trackId] ?? NEW_FLEET;
}

/** Writes part of a fleet's record. */
export function setFleet(d: GameState, trackId: string, patch: Partial<FleetRecord>): void {
  d.conflict = { ...d.conflict, fleets: { ...d.conflict.fleets, [trackId]: { ...fleetRecord(d, trackId), ...patch } } };
}

/** What the dial multiplies this fleet's output and strength by now. */
export function fleetOutput(s: Pick<GameState, 'conflict'>, reg: ContentRegistry, trackId: string): number {
  return fleetAutonomy(reg)[fleetRecord(s, trackId).autonomy].output;
}

/**
 * The share of a track's per-level yield that arrives: 1 for a track that is no fleet; for a fleet, what it has not
 * lost times the dial's output. The rates and the cycle ledger both read it.
 */
export function fleetYield(s: Pick<GameState, 'conflict'>, reg: ContentRegistry, trackId: string): number {
  if (fleetUnit(reg, trackId) === undefined) return 1;
  return (1 - fleetRecord(s, trackId).lost) * fleetOutput(s, reg, trackId);
}

export interface FleetReading {
  unit: FleetUnit;
  level: number;
  /** Strength with nothing lost, at the dial's output. */
  full: number;
  /** Strength now: full less what is lost. */
  strength: number;
  /** What battle can never take it below: full times (1 - lossCap). */
  floor: number;
}

/** One fleet's strength now, from its level, its losses and its dial. */
export function fleetReading(s: Pick<GameState, 'conflict' | 'levels'>, reg: ContentRegistry, unit: FleetUnit): FleetReading {
  const level = s.levels[unit.repeatable] ?? 0, record = fleetRecord(s, unit.repeatable);
  const full = level * unit.strengthPerLevel * fleetAutonomy(reg)[record.autonomy].output;
  return { unit, level, full, strength: full * (1 - record.lost), floor: full * (1 - reg.world.conflict.fleets.lossCap) };
}

export interface DomainFleet { strength: number; floor: number; members: FleetReading[] }

/** Every fleet in a domain, summed: the force a fleet battle there meets, and the floor it breaks off at. */
export function domainFleet(s: Pick<GameState, 'conflict' | 'levels'>, reg: ContentRegistry, domain: string): DomainFleet {
  const members = reg.world.conflict.fleets.units.filter((unit) => unit.domain === domain).map((unit) => fleetReading(s, reg, unit));
  return { members, strength: members.reduce((sum, entry) => sum + entry.strength, 0), floor: members.reduce((sum, entry) => sum + entry.floor, 0) };
}

/**
 * Takes `strengthLost` from a domain's fleets, each in proportion to what it holds above its floor, so all reach their
 * floors together and none passes the lossCap. Returns what was taken.
 */
export function applyFleetLosses(d: GameState, reg: ContentRegistry, domain: string, strengthLost: number): number {
  const fleet = domainFleet(d, reg, domain), headroom = fleet.strength - fleet.floor;
  if (headroom <= 0 || strengthLost <= 0) return 0;
  const taken = Math.min(strengthLost, headroom), cap = reg.world.conflict.fleets.lossCap;
  for (const member of fleet.members) {
    if (member.full <= 0) continue;
    const share = ((member.strength - member.floor) / headroom) * taken / member.full;
    setFleet(d, member.unit.repeatable, { lost: Math.min(cap, fleetRecord(d, member.unit.repeatable).lost + share) });
  }
  return taken;
}

/** The share of a fleet a split would take now: the split share, never past what the lossCap leaves. */
export function splitShareNow(s: Pick<GameState, 'conflict'>, reg: ContentRegistry, trackId: string): number {
  const { splitShare, lossCap } = reg.world.conflict.fleets;
  return Math.max(0, Math.min(splitShare, lossCap - fleetRecord(s, trackId).lost));
}

/** Points of a fleet's full strength rebuilt each second now: the free rate plus every running fab's. */
export function fleetRebuildPerSec(s: GameState, reg: ContentRegistry): number {
  const { freeRebuildPerSec, fabs } = reg.world.conflict.fleets;
  let rate = freeRebuildPerSec, scope: ReturnType<typeof useScope> | undefined;
  for (const fab of fabs) {
    const node = reg.nodes.get(fab.node);
    if (node === undefined || !s.unlockedNodes.includes(fab.node)) continue;
    scope ??= useScope(s, reg);
    if (nodeOutputScaleIn(scope, node) !== null) rate += fab.rebuildPerSec;
  }
  return rate;
}

/** Whether the raid under way is a fleet battle: a rival fleet or a deviant. */
export function fleetBattleKind(s: Pick<GameState, 'conflict'>, reg: ContentRegistry): { domain: string } | undefined {
  const id = s.conflict.raid?.id;
  const kind = id === undefined ? undefined : reg.world.conflict.raids.find((entry) => entry.id === id);
  if (kind === undefined) return undefined;
  return kind.source === 'DEVIANT' || kind.resolution === 'LANCHESTER' ? kind : undefined;
}

/**
 * Whether a fleet battle holds this fleet's rebuild: one is inbound on or fighting in its domain. Holding it keeps the
 * battle's forecast exact, as a raid holds its target's repair.
 */
export function rebuildHeld(s: Pick<GameState, 'conflict'>, reg: ContentRegistry, unit: FleetUnit): boolean {
  const battle = fleetBattleKind(s, reg);
  return battle !== undefined && battle.domain === unit.domain && s.conflict.raid?.stage !== 'AFTERMATH';
}
