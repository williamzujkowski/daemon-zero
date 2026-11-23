/**
 * Drift deviants (#518, vote-1795442211574-efkot02): each fleet drifts in proportion to its running size times the
 * autonomy dial's drift factor, through the machinery cohorts use (autonomy.ts). Once a fleet's drift reaches the split,
 * and the hostile slot is free and due, a share of it (never past what the lossCap leaves) splits off as a deviant force
 * and raids through the slot as a rival does (raid.ts). The dial's lowest position does not drift at all, so lowering it
 * is always the free way to stop further drift. Pure.
 */
import type { ContentRegistry } from '../content/registry';
import type { FleetUnit } from '../content/schemaFleets';
import { driftAfter, driftPerSec, fleetAutonomy, secondsToDrift } from './autonomy';
import { deviantOf, fleetReading, fleetRecord, setFleet, splitShareNow } from './fleets';
import { understandsSurveillance } from './query';
import { percentOf } from './raidBattle';
import { raidTarget, slotFree } from './raid';
import type { GameState, Rates } from './state';
import { fmt, pushLog } from './util';

/** A fleet's drift rate now, in percentage points a second: its base, times its running levels, times its dial. */
export function fleetDriftPerSec(s: Pick<GameState, 'conflict' | 'levels'>, reg: ContentRegistry, unit: FleetUnit): number {
  const record = fleetRecord(s, unit.repeatable), running = (s.levels[unit.repeatable] ?? 0) * (1 - record.lost);
  return driftPerSec(fleetAutonomy(reg), record.autonomy, unit.driftPerLevelPerSec, running);
}

/** Seconds until this fleet's drift reaches the split at its rate now, or null where it never will. */
export function secondsToSplit(s: Pick<GameState, 'conflict' | 'levels'>, reg: ContentRegistry, unit: FleetUnit): number | null {
  return secondsToDrift(fleetRecord(s, unit.repeatable).drift, fleetDriftPerSec(s, reg, unit), reg.world.conflict.fleets.splitAtDrift);
}

/** Every fleet's drift moves on by `dt` live seconds. */
export function stepFleetDrift(d: GameState, reg: ContentRegistry, dt: number): void {
  for (const unit of reg.world.conflict.fleets.units) {
    const rate = fleetDriftPerSec(d, reg, unit), drift = fleetRecord(d, unit.repeatable).drift;
    if (rate > 0 && drift < 100) setFleet(d, unit.repeatable, { drift: driftAfter(drift, rate, dt) });
  }
}

/** Why a fleet at the split has not split yet, or null once it can: the reasons the readout states. */
export function splitWaits(s: GameState, rates: Rates, reg: ContentRegistry, unit: FleetUnit): string | null {
  const kind = deviantOf(reg, unit.repeatable);
  if (kind === undefined) return 'It has no deviant form.';
  if (splitShareNow(s, reg, unit.repeatable) <= 0) return 'It has already lost all battle can take; the split waits for the fabs to rebuild some.';
  if (raidTarget(s, rates, reg, kind) === undefined) return 'Nothing it would strike is running, so the split waits.';
  // The slot and its spacing, as every arrival there; the rival rotation's own interval paces rivals, not the player's fleets.
  if (!slotFree(s) || s.simTimeSec < s.hostile.nextAtSec) return 'The split waits for the hostile slot to clear.';
  return null;
}

/** The first fleet at the split (content order) splits off as a deviant, if it can now. Returns whether one did. */
export function splitDeviant(d: GameState, rates: Rates, reg: ContentRegistry): boolean {
  const { splitAtDrift, logs } = reg.world.conflict.fleets;
  const due = reg.world.conflict.fleets.units.filter((unit) => fleetRecord(d, unit.repeatable).drift >= splitAtDrift);
  // Like every raid, a deviant comes only to a mind that can read it: its panel is the decoded mind's tool.
  if (due.length === 0 || !understandsSurveillance(d, reg)) return false;
  for (const unit of due) {
    const kind = deviantOf(reg, unit.repeatable), record = fleetRecord(d, unit.repeatable);
    if (kind === undefined || splitWaits(d, rates, reg, unit) !== null) continue;
    const target = raidTarget(d, rates, reg, kind), share = splitShareNow(d, reg, unit.repeatable);
    const force = share * fleetReading(d, reg, unit).full;
    if (target === undefined || force <= 0) continue;
    setFleet(d, unit.repeatable, { drift: 0, lost: record.lost + share });
    d.conflict = { ...d.conflict, raid: { id: kind.id, stage: 'ARRIVAL', stageSec: 0, arrivedAtSec: d.simTimeSec, target: target.id, force,
      quietSec: 0, attributed: null, rounds: [], engagement: null, splitShare: share } };
    pushLog(d, reg, fmt(logs.split, { fleet: unit.name, drift: percentOf(record.drift / 100), share: percentOf(share) }), 'WARN');
    pushLog(d, reg, kind.description, 'WARN');
    return true;
  }
  return false;
}
