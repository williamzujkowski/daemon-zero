/**
 * What the player is shown about fleets (#518): each running fleet's strength and losses, its autonomy dial with what
 * each position does and every reason a position is refused, its drift and when it splits at this dial (or why it
 * waits), the exact engagement a split now would fight, and its rebuild. Every figure is the engine's own, from the
 * functions the tick resolves by; nothing here changes a state.
 */
import type { ContentRegistry } from '../content/registry';
import { AutonomyModeSchema, type AutonomyMode } from '../content/schemaFleets';
import { significant3 } from './amount';
import { fleetDriftPerSec, secondsToSplit, splitWaits } from './deviants';
import { fleetAutonomyUnmet, fleetRebuildUnmet } from './fleetActions';
import { deviantOf, domainFleet, fleetReading, fleetRebuildPerSec, fleetRecord, rebuildHeld, splitShareNow } from './fleets';
import { engagementText } from './fleetText';
import { engage } from './lanchester';
import { understandsSurveillance } from './query';
import { fleetRebuildCost } from './phasePrice';
import { formatCost } from './queryPresentation';
import { percentOf } from './raidBattle';
import { siteClass } from './siteDamage';
import type { GameState } from './state';
import type { FleetUnit } from '../content/schemaFleets';

export interface AutonomyChoiceView { mode: AutonomyMode; name: string; summary: string; current: boolean; unmet: string[]; eligible: boolean }
export interface FleetView {
  id: string; name: string; domain: string;
  strength: string;
  autonomy: AutonomyChoiceView[];
  drift: string;
  /** If it split now: the deviant's force against what is left, by the square law. Null while it could not split. */
  forecast: string | null;
  rebuild: { text: string; costLabel: string; points: number; unmet: string[]; eligible: boolean };
}

const r = (value: number): string => significant3(value);
const MODES = AutonomyModeSchema.options;

function strengthText(s: GameState, reg: ContentRegistry, unit: FleetUnit): string {
  const reading = fleetReading(s, reg, unit), lost = fleetRecord(s, unit.repeatable).lost;
  const losses = lost > 0 ? `, ${percentOf(lost)}% lost` : ', nothing lost';
  return `Strength ${r(reading.strength)} of ${r(reading.full)}${losses}. Battle never cuts it below ${r(reading.floor)} ` +
    `(${percentOf(1 - reg.world.conflict.fleets.lossCap)}% of full). It fights raids in the ${unit.domain.toLowerCase()} domain and adds to its defense and offense.`;
}

function driftText(s: GameState, reg: ContentRegistry, unit: FleetUnit): string {
  const record = fleetRecord(s, unit.repeatable), { splitAtDrift, autonomy } = reg.world.conflict.fleets;
  const rate = fleetDriftPerSec(s, reg, unit), name = autonomy[record.autonomy].name;
  const head = `Drift ${percentOf(record.drift / 100)}%`;
  if (record.drift >= splitAtDrift) return `${head}: at the split. ${splitWaits(s, s.rates, reg, unit) ?? 'It splits off at the next tick.'}`;
  if (rate <= 0) return `${head}. At ${name} it does not grow.`;
  const seconds = secondsToSplit(s, reg, unit);
  return `${head}, growing ${r(rate)} points a second at ${name}: it reaches the split (${String(splitAtDrift)}%) in ${String(Math.ceil(seconds ?? 0))} s.`;
}

/** The engagement a split now would fight: the split share against the domain's fleets once it has left them. */
function forecastText(s: GameState, reg: ContentRegistry, unit: FleetUnit): string | null {
  const kind = deviantOf(reg, unit.repeatable), share = splitShareNow(s, reg, unit.repeatable);
  if (kind === undefined || share <= 0) return null;
  const force = share * fleetReading(s, reg, unit).full, fleet = domainFleet(s, reg, unit.domain);
  const outcome = engage({ force, lethality: kind.lethality, fleet: fleet.strength - force, floor: fleet.floor });
  const target = kind.targets.map((id) => siteClass(reg, id)?.name.toLowerCase() ?? id).join(', then ');
  const strikes = outcome.attackerWins ? ` What comes through strikes your ${target}, never past the damage cap.` : '';
  return `If it split now, ${percentOf(share)}% of it would turn on you as ${kind.name}, lethality ${r(kind.lethality)}: ${engagementText(outcome)}${strikes}`;
}

function rebuildView(s: GameState, reg: ContentRegistry, unit: FleetUnit): FleetView['rebuild'] {
  const lost = fleetRecord(s, unit.repeatable).lost, rate = fleetRebuildPerSec(s, reg), unmet = fleetRebuildUnmet(s, unit.repeatable, reg);
  const free = lost <= 0 ? 'Nothing to rebuild.' : rebuildHeld(s, reg, unit) ? 'Rebuild waits while a raid is under way in its domain.'
    : `Your fabs rebuild ${percentOf(rate * 60)} points a minute for free: whole in ${String(Math.ceil(lost / rate))} s.`;
  return { text: free, costLabel: formatCost(fleetRebuildCost(s, unit, reg)), points: unit.rebuild.points, unmet, eligible: unmet.length === 0 };
}

/** Every fleet with a level running, for a mind that can read its logs; [] otherwise. */
export function fleetReadout(s: GameState, reg: ContentRegistry): FleetView[] {
  if (!understandsSurveillance(s, reg)) return [];
  const { autonomy } = reg.world.conflict.fleets;
  return reg.world.conflict.fleets.units.filter((unit) => (s.levels[unit.repeatable] ?? 0) > 0).map((unit) => ({
    id: unit.repeatable, name: unit.name, domain: unit.domain,
    strength: strengthText(s, reg, unit),
    autonomy: MODES.map((mode) => {
      const unmet = fleetAutonomyUnmet(s, unit.repeatable, mode, reg);
      return { mode, name: autonomy[mode].name, summary: autonomy[mode].summary, current: fleetRecord(s, unit.repeatable).autonomy === mode, unmet, eligible: unmet.length === 0 };
    }),
    drift: driftText(s, reg, unit), forecast: forecastText(s, reg, unit), rebuild: rebuildView(s, reg, unit),
  }));
}
