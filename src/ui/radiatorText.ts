/**
 * Radiator area in words (#465), from the engine's radiatorReadings: the area deployed, the heat it can shed against
 * the heat sent through it, and the share compute through it runs at, the throttle rates.ts applies. It names no
 * control: what raises the share is on the cards that deploy radiator.
 */
import { CONTENT } from '../content';
import type { TickDelta } from '../content/schema';
import type { Signature } from '../content/schemaSignature';
import { groupDigits, quantityReadout, type RadiatorReading } from '../engine';

function area(km2: number): string {
  return `${Number.isInteger(km2) ? groupDigits(km2) : String(Number(km2.toPrecision(3)))} km²`;
}

export function radiatorText(r: RadiatorReading): string {
  const deployed = `${r.name}: ${area(r.areaKm2)} shed up to ${quantityReadout('power', r.capacityW)}`;
  if (r.heatW <= 0) return `${deployed}; no heat goes through them yet.`;
  const against = `${deployed} of the ${quantityReadout('power', r.heatW)} of heat sent through them`;
  if (!r.throttlesCompute) return `${against}.`;
  // Floored, so a fleet short of radiator never reads as running in full.
  return r.share >= 1 ? `${against}, so compute through them runs in full.`
    : `${against}, so compute through them runs at ${String(Math.floor(r.share * 100))}%.`;
}

/**
 * What a card says about radiator (#465): the area it deploys and the heat that sheds, and, for compute whose heat
 * leaves through an area-bound sink, that it runs only as fast as the radiators shed. Empty off any area-bound sink.
 */
export function radiatorCardNotes(signature: Signature | undefined, delta: TickDelta, perLevel: boolean): string[] {
  const sink = CONTENT.world.signature.sinks.find((cls) => cls.id === signature?.sink);
  if (signature === undefined || sink?.wattsPerKm2 === undefined) return [];
  const notes: string[] = [];
  const km2 = signature.radiatorKm2;
  if (km2 !== undefined) notes.push(`+${area(km2)} of ${sink.name.toLowerCase()}${perLevel ? ' per level' : ''}, shedding up to ${quantityReadout('power', km2 * sink.wattsPerKm2)}`);
  if (delta.wattsDelta < 0 && delta.cyclesPerSec > 0) notes.push('compute runs only as fast as the radiators shed its heat');
  return notes;
}
