/**
 * What the player is shown about conflict (#517): each open domain's defense by type and offense, and each site class's
 * damage with its repair. The raid under way is raidQuery.ts; fleets are fleetQuery.ts (#518). Every figure is the
 * engine's own, from the functions the tick resolves by; nothing here changes a state.
 */
import type { ContentRegistry } from '../content/registry';
import type { SiteClass } from '../content/schemaConflict';
import { significant3 } from './amount';
import { conflictStats, type DomainStats } from './conflictStats';
import { domainFleet } from './fleets';
import { understandsSurveillance } from './query';
import { formatCost } from './queryPresentation';
import { percentOf } from './raidBattle';
import { repairUnmet } from './repairActions';
import { classDamage, repairHeld, repairPerSec } from './siteDamage';
import type { GameState } from './state';

export interface DefenseTypeView { id: string; name: string; raw: number; effective: number; softCap: number; dutyCycle: number; anchor: string; text: string }
export interface SiteDamageView {
  id: string; name: string; damage: number; held: boolean;
  /** What the damage does, stated exactly. */
  text: string;
  repair: { costLabel: string; points: number; unmet: string[]; eligible: boolean };
}
export interface DomainView {
  id: string; name: string; unit: string; defense: DefenseTypeView[]; offense: string; classes: SiteDamageView[];
  /** The domain's fleets (#518), summed, while any runs; null otherwise. */
  fleet: string | null;
}

const rating = (value: number): string => significant3(value);

function typeView(reading: DomainStats['defense'][number]): DefenseTypeView {
  const { type, raw, effective } = reading;
  const duty = type.dutyCycle < 1 ? `, engaging ${percentOf(type.dutyCycle)}% of the time` : '';
  return { id: type.id, name: type.name, raw, effective, softCap: type.softCap, dutyCycle: type.dutyCycle, anchor: type.anchor,
    text: `${type.name}: ${rating(effective)} of ${rating(raw)} held (it never passes ${rating(type.softCap)})${duty}.` };
}

function damageText(cls: SiteClass, damage: number, rate: number, held: boolean): string {
  const effect = cls.holds === 'INCOME' ? `${percentOf(damage)}% of positive net income is taken` : `its holdings deliver ${percentOf(damage)}% less compute`;
  const repair = held ? 'Repair waits while the raid is on it.' : `Free repair restores ${percentOf(rate * 60)} points a minute: clear in ${String(Math.ceil(damage / rate))} s.`;
  return `${cls.name}: ${effect}. ${repair}`;
}

function classView(s: GameState, reg: ContentRegistry, cls: SiteClass, rate: number): SiteDamageView {
  const damage = classDamage(s, cls.id), held = repairHeld(s, cls.id), unmet = repairUnmet(s, cls.id, reg);
  return { id: cls.id, name: cls.name, damage, held, text: damageText(cls, damage, rate, held),
    repair: { costLabel: formatCost(cls.repair.cost), points: cls.repair.points, unmet, eligible: unmet.length === 0 } };
}

/** A domain's fleets, summed, for the readout: what a fleet battle there meets and where it breaks off. */
function fleetLine(s: GameState, reg: ContentRegistry, domain: string): string | null {
  const fleet = domainFleet(s, reg, domain);
  if (fleet.members.every((member) => member.level <= 0)) return null;
  return `Fleets: strength ${rating(fleet.strength)}, breaking off at ${rating(fleet.floor)}. A fleet raid meets them first, by the square law. ` +
    'Set their autonomy in SWARM.';
}

/** Whether a domain is shown: open by phase, or carrying damage (which outlasts nothing, but is always repairable where shown). */
function shown(s: GameState, reg: ContentRegistry, entry: DomainStats): boolean {
  return entry.domain.fromPhase <= s.currentPhase || reg.world.conflict.siteClasses.some((cls) => cls.domain === entry.domain.id && classDamage(s, cls.id) > 0);
}

/** The open domains' stats and every damaged class, for a mind that can read them; [] before the first domain opens. */
export function conflictReadout(s: GameState, reg: ContentRegistry): DomainView[] {
  if (!understandsSurveillance(s, reg)) return [];
  const rate = repairPerSec(s, reg);
  return conflictStats(s, reg).filter((entry) => shown(s, reg, entry)).map(({ domain, defense, offenseRaw, offense }) => ({
    id: domain.id, name: domain.name, unit: domain.unit, defense: defense.map(typeView),
    offense: `Offense: ${rating(offense)} of ${rating(offenseRaw)} held (it never passes ${rating(domain.offenseSoftCap)}). Each round it removes up to ` +
      `${percentOf(reg.world.conflict.raid.counterStrikeShare)}% of a raid's force, by offense / (offense + force).`,
    classes: reg.world.conflict.siteClasses.filter((cls) => cls.domain === domain.id && classDamage(s, cls.id) > 0).map((cls) => classView(s, reg, cls, rate)),
    fleet: fleetLine(s, reg, domain.id),
  }));
}
